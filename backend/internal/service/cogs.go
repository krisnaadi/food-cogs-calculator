package service

import (
	"context"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/krisnaadi/cogs-app/internal/db"
)

func pgNumericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
}

func pgTextToString(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}

func unitFactor(ingredientUnit, lineUnit string) float64 {
	if ingredientUnit == lineUnit {
		return 1
	}
	type pair struct{ from, to string }
	table := map[pair]float64{
		{"kg", "g"}: 0.001, {"kg", "mg"}: 0.000001,
		{"g", "kg"}: 1000, {"g", "mg"}: 0.001,
		{"mg", "g"}: 1000, {"mg", "kg"}: 1000000,
		{"l", "ml"}: 0.001, {"ml", "l"}: 1000,
	}
	if f, ok := table[pair{ingredientUnit, lineUnit}]; ok {
		return f
	}
	return 1
}

// --- types ---

type COGSInput struct {
	RecipeID     uuid.UUID
	BatchSize    int
	TargetMargin float64
	LaborCost    float64
	OverheadCost float64
	OverheadID   *uuid.UUID
}

type LineBreakdown struct {
	IngredientID   string
	IngredientName string
	IsSubRecipe    bool
	Quantity       float64
	LineUnit       string
	IngredientUnit string
	PricePerUnit   float64
	EffectivePrice float64
	WastePct       float64
	RawCost        float64
	AdjustedCost   float64
	Percentage     float64
}

type COGSResult struct {
	RecipeID        uuid.UUID
	RecipeName      string
	BatchSize       int
	BatchYield      int
	IngredientCost  float64
	LaborCost       float64
	OverheadCost    float64
	TotalBatchCost  float64
	CostPerUnit     float64
	SuggestedPrice  float64
	MarginPct       float64
	BreakdownByLine []LineBreakdown
}

type COGSService struct {
	queries db.Querier
}

func NewCOGSService(q db.Querier) *COGSService {
	return &COGSService{queries: q}
}

// calcLineCost recursively resolves ingredient and sub-recipe lines.
// Returns total cost for the given recipe scaled by batchSize, plus breakdown entries.
func (s *COGSService) calcLineCost(
	ctx context.Context,
	recipeID uuid.UUID,
	batchSize int,
	depth int, // guard against circular references
) (float64, []LineBreakdown, error) {
	if depth > 5 {
		return 0, nil, nil // circular reference guard
	}

	lines, err := s.queries.GetRecipeLines(ctx, recipeID)
	if err != nil {
		return 0, nil, err
	}

	var total float64
	var breakdown []LineBreakdown

	for _, line := range lines {
		switch {

		// --- direct ingredient ---
		case line.IngredientID.Valid:
			ingID, err := uuid.FromBytes(line.IngredientID.Bytes[:])
			if err != nil {
				continue
			}
			ingUnit := pgTextToString(line.IngredientUnit)
			lineUnit := line.Unit
			price := pgNumericToFloat(line.PricePerUnit)
			wastePct := pgNumericToFloat(line.WastePct)
			qty := line.Quantity

			factor := unitFactor(ingUnit, lineUnit)
			effectivePrice := price * factor
			raw := qty * effectivePrice
			adjusted := raw
			if wastePct > 0 && wastePct < 1 {
				adjusted = raw / (1 - wastePct)
			}
			adjusted *= float64(batchSize)
			total += adjusted

			breakdown = append(breakdown, LineBreakdown{
				IngredientID:   ingID.String(),
				IngredientName: pgTextToString(line.IngredientName),
				IsSubRecipe:    false,
				Quantity:       qty,
				LineUnit:       lineUnit,
				IngredientUnit: ingUnit,
				PricePerUnit:   price,
				EffectivePrice: round(effectivePrice),
				WastePct:       wastePct,
				RawCost:        round(raw),
				AdjustedCost:   round(adjusted),
			})

		// --- sub-recipe ---
		case line.SubRecipeID.Valid:
			subID, err := uuid.FromBytes(line.SubRecipeID.Bytes[:])
			if err != nil {
				continue
			}
			subRecipe, err := s.queries.GetRecipe(ctx, subID)
			if err != nil {
				continue
			}

			// recursively get the cost for 1 batch of the sub-recipe
			subBatchCost, _, err := s.calcLineCost(ctx, subID, 1, depth+1)
			if err != nil {
				continue
			}

			batchYield := float64(subRecipe.BatchYield)
			if batchYield == 0 {
				batchYield = 1
			}

			// cost per one yield-unit of the sub-recipe
			costPerYieldUnit := subBatchCost / batchYield

			// apply unit conversion between sub-recipe yield_unit and line unit
			factor := unitFactor(subRecipe.YieldUnit, line.Unit)
			lineCost := line.Quantity * costPerYieldUnit * factor * float64(batchSize)
			total += lineCost

			breakdown = append(breakdown, LineBreakdown{
				IngredientID:   subID.String(),
				IngredientName: subRecipe.Name,
				IsSubRecipe:    true,
				Quantity:       line.Quantity,
				LineUnit:       line.Unit,
				IngredientUnit: subRecipe.YieldUnit,
				EffectivePrice: round(costPerYieldUnit * factor),
				AdjustedCost:   round(lineCost),
				RawCost:        round(lineCost),
			})
		}
	}

	return total, breakdown, nil
}

func (s *COGSService) Calculate(ctx context.Context, input COGSInput) (*COGSResult, error) {
	recipe, err := s.queries.GetRecipe(ctx, input.RecipeID)
	if err != nil {
		return nil, err
	}

	ingredientCost, breakdown, err := s.calcLineCost(ctx, input.RecipeID, input.BatchSize, 0)
	if err != nil {
		return nil, err
	}

	// fill percentages
	if ingredientCost > 0 {
		for i := range breakdown {
			breakdown[i].Percentage = round((breakdown[i].AdjustedCost / ingredientCost) * 100)
		}
	}

	totalBatchCost := ingredientCost + input.LaborCost + input.OverheadCost
	batchYield := int(recipe.BatchYield) * input.BatchSize
	if batchYield == 0 {
		batchYield = 1
	}

	costPerUnit := totalBatchCost / float64(batchYield)
	suggestedPrice := costPerUnit
	if input.TargetMargin > 0 && input.TargetMargin < 1 {
		suggestedPrice = costPerUnit / (1 - input.TargetMargin)
	}

	return &COGSResult{
		RecipeID:        recipe.ID,
		RecipeName:      recipe.Name,
		BatchSize:       input.BatchSize,
		BatchYield:      batchYield,
		IngredientCost:  round(ingredientCost),
		LaborCost:       round(input.LaborCost),
		OverheadCost:    round(input.OverheadCost),
		TotalBatchCost:  round(totalBatchCost),
		CostPerUnit:     round(costPerUnit),
		SuggestedPrice:  round(suggestedPrice),
		MarginPct:       input.TargetMargin,
		BreakdownByLine: breakdown,
	}, nil
}

func (s *COGSService) SaveSnapshot(ctx context.Context, result *COGSResult, overheadID *uuid.UUID) error {
	params := db.CreateCOGSSnapshotParams{
		RecipeID:       result.RecipeID,
		IngredientCost: result.IngredientCost,
		LaborCost:      result.LaborCost,
		OverheadCost:   result.OverheadCost,
		TotalBatchCost: result.TotalBatchCost,
		CostPerUnit:    result.CostPerUnit,
		SuggestedPrice: result.SuggestedPrice,
		MarginPct:      result.MarginPct,
	}
	if overheadID != nil {
		params.OverheadID = pgtype.UUID{Bytes: *overheadID, Valid: true}
	}
	_, err := s.queries.CreateCOGSSnapshot(ctx, params)
	return err
}

func round(v float64) float64 {
	return math.Round(v*100) / 100
}
