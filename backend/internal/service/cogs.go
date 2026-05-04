package service

import (
	"context"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/krisnaadi/cogs-app/internal/db"
)

// --- pgtype helpers ---

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

// --- unit conversion ---
// Returns how many ingredientUnits are in 1 lineUnit.
// e.g. ingredientUnit=kg, lineUnit=g → 1g = 0.001kg → 0.001
// Multiply price_per_ingredientUnit by this factor to get price_per_lineUnit.
func unitFactor(ingredientUnit, lineUnit string) float64 {
	if ingredientUnit == lineUnit {
		return 1
	}
	type pair struct{ from, to string }
	table := map[pair]float64{
		// weight
		{"kg", "g"}:  0.001,
		{"kg", "mg"}: 0.000001,
		{"g", "kg"}:  1000,
		{"g", "mg"}:  0.001,
		{"mg", "g"}:  1000,
		{"mg", "kg"}: 1000000,
		// volume
		{"l", "ml"}: 0.001,
		{"ml", "l"}: 1000,
		// mass ↔ volume (approximate water baseline — override as needed)
		{"kg", "ml"}: 0.001,
		{"l", "g"}:   1,
	}
	if f, ok := table[pair{ingredientUnit, lineUnit}]; ok {
		return f
	}
	return 1 // unmapped: assume same unit
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
	Quantity       float64
	LineUnit       string  // unit used in this recipe line
	IngredientUnit string  // unit the price is defined in
	PricePerUnit   float64 // price per ingredient unit
	EffectivePrice float64 // price per line unit after conversion
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

func (s *COGSService) Calculate(ctx context.Context, input COGSInput) (*COGSResult, error) {
	recipe, err := s.queries.GetRecipe(ctx, input.RecipeID)
	if err != nil {
		return nil, err
	}

	lines, err := s.queries.GetRecipeLines(ctx, input.RecipeID)
	if err != nil {
		return nil, err
	}

	var ingredientCost float64
	var breakdown []LineBreakdown

	for _, line := range lines {
		if !line.IngredientID.Valid {
			continue
		}
		ingID, err := uuid.FromBytes(line.IngredientID.Bytes[:])
		if err != nil {
			continue
		}

		ingredientUnit := pgTextToString(line.IngredientUnit)
		lineUnit := line.Unit
		pricePerUnit := pgNumericToFloat(line.PricePerUnit)
		wastePct := pgNumericToFloat(line.WastePct)
		quantity := line.Quantity

		// Convert: e.g. ingredient=18000/kg, line uses g
		// factor = 0.001 → effectivePrice = 18000 × 0.001 = 18 IDR/g
		factor := unitFactor(ingredientUnit, lineUnit)
		effectivePrice := pricePerUnit * factor

		rawCost := quantity * effectivePrice
		adjustedCost := rawCost
		if wastePct > 0 && wastePct < 1 {
			adjustedCost = rawCost / (1 - wastePct)
		}
		adjustedCost *= float64(input.BatchSize)

		ingredientCost += adjustedCost

		breakdown = append(breakdown, LineBreakdown{
			IngredientID:   ingID.String(),
			IngredientName: pgTextToString(line.IngredientName),
			Quantity:       quantity,
			LineUnit:       lineUnit,
			IngredientUnit: ingredientUnit,
			PricePerUnit:   pricePerUnit,
			EffectivePrice: round(effectivePrice),
			WastePct:       wastePct,
			RawCost:        round(rawCost),
			AdjustedCost:   round(adjustedCost),
		})
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
