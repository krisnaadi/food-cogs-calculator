package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/krisnaadi/cogs-app/internal/db"
	"github.com/krisnaadi/cogs-app/internal/service"
)

type COGSHandler struct {
	queries     db.Querier
	cogsService *service.COGSService
}

func NewCOGSHandler(q db.Querier) *COGSHandler {
	return &COGSHandler{
		queries:     q,
		cogsService: service.NewCOGSService(q),
	}
}

type cogsRequest struct {
	RecipeID     string  `json:"recipe_id"`
	BatchSize    int     `json:"batch_size"`
	TargetMargin float64 `json:"target_margin"`
	LaborCost    float64 `json:"labor_cost"`
	OverheadCost float64 `json:"overhead_cost"`
	OverheadID   *string `json:"overhead_id"`
	SaveSnapshot bool    `json:"save_snapshot"`
}

type lineBreakdownResponse struct {
	IngredientID   string  `json:"ingredient_id"`
	IngredientName string  `json:"ingredient_name"`
	Quantity       float64 `json:"quantity"`
	LineUnit       string  `json:"line_unit"`
	IngredientUnit string  `json:"ingredient_unit"`
	PricePerUnit   float64 `json:"price_per_unit"`
	EffectivePrice float64 `json:"effective_price"`
	WastePct       float64 `json:"waste_pct"`
	RawCost        float64 `json:"raw_cost"`
	AdjustedCost   float64 `json:"adjusted_cost"`
	Percentage     float64 `json:"percentage"`
}

type cogsResponse struct {
	RecipeID        string                  `json:"recipe_id"`
	RecipeName      string                  `json:"recipe_name"`
	BatchSize       int                     `json:"batch_size"`
	BatchYield      int                     `json:"batch_yield"`
	IngredientCost  float64                 `json:"ingredient_cost"`
	LaborCost       float64                 `json:"labor_cost"`
	OverheadCost    float64                 `json:"overhead_cost"`
	TotalBatchCost  float64                 `json:"total_batch_cost"`
	CostPerUnit     float64                 `json:"cost_per_unit"`
	SuggestedPrice  float64                 `json:"suggested_price"`
	MarginPct       float64                 `json:"margin_pct"`
	BreakdownByLine []lineBreakdownResponse `json:"breakdown_by_line"`
}

func (h *COGSHandler) Routes() func(r interface {
	Post(string, http.HandlerFunc)
}) {
	return nil // registered manually below
}

func (h *COGSHandler) Calculate(w http.ResponseWriter, r *http.Request) {
	var req cogsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	recipeID, err := uuid.Parse(req.RecipeID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid recipe_id")
		return
	}
	if req.BatchSize <= 0 {
		req.BatchSize = 1
	}

	input := service.COGSInput{
		RecipeID:     recipeID,
		BatchSize:    req.BatchSize,
		TargetMargin: req.TargetMargin,
		LaborCost:    req.LaborCost,
		OverheadCost: req.OverheadCost,
	}
	if req.OverheadID != nil {
		id, err := uuid.Parse(*req.OverheadID)
		if err == nil {
			input.OverheadID = &id
		}
	}

	result, err := h.cogsService.Calculate(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if req.SaveSnapshot {
		_ = h.cogsService.SaveSnapshot(r.Context(), result, input.OverheadID)
	}

	resp := cogsResponse{
		RecipeID:       result.RecipeID.String(),
		RecipeName:     result.RecipeName,
		BatchSize:      result.BatchSize,
		BatchYield:     result.BatchYield,
		IngredientCost: result.IngredientCost,
		LaborCost:      result.LaborCost,
		OverheadCost:   result.OverheadCost,
		TotalBatchCost: result.TotalBatchCost,
		CostPerUnit:    result.CostPerUnit,
		SuggestedPrice: result.SuggestedPrice,
		MarginPct:      result.MarginPct,
	}
	for _, l := range result.BreakdownByLine {
		resp.BreakdownByLine = append(resp.BreakdownByLine, lineBreakdownResponse{
			IngredientID:   l.IngredientID,
			IngredientName: l.IngredientName,
			Quantity:       l.Quantity,
			LineUnit:       l.LineUnit,
			IngredientUnit: l.IngredientUnit,
			PricePerUnit:   l.PricePerUnit,
			EffectivePrice: l.EffectivePrice,
			WastePct:       l.WastePct,
			RawCost:        l.RawCost,
			AdjustedCost:   l.AdjustedCost,
			Percentage:     l.Percentage,
		})
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *COGSHandler) ListOverheads(w http.ResponseWriter, r *http.Request) {
	items, err := h.queries.ListOverheadTemplates(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *COGSHandler) CreateOverhead(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name          string  `json:"name"`
		PackagingCost float64 `json:"packaging_cost"`
		UtilitiesCost float64 `json:"utilities_cost"`
		OtherFixed    float64 `json:"other_fixed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	item, err := h.queries.CreateOverheadTemplate(r.Context(), db.CreateOverheadTemplateParams{
		Name:          req.Name,
		PackagingCost: req.PackagingCost,
		UtilitiesCost: req.UtilitiesCost,
		OtherFixed:    req.OtherFixed,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (h *COGSHandler) ListHistory(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.ListCOGSHistory(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	type historyRow struct {
		ID             uuid.UUID `json:"id"`
		RecipeID       uuid.UUID `json:"recipe_id"`
		RecipeName     string    `json:"recipe_name"`
		BatchYield     int32     `json:"batch_yield"`
		YieldUnit      string    `json:"yield_unit"`
		IngredientCost float64   `json:"ingredient_cost"`
		LaborCost      float64   `json:"labor_cost"`
		OverheadCost   float64   `json:"overhead_cost"`
		TotalBatchCost float64   `json:"total_batch_cost"`
		CostPerUnit    float64   `json:"cost_per_unit"`
		SuggestedPrice float64   `json:"suggested_price"`
		MarginPct      float64   `json:"margin_pct"`
		CalculatedAt   string    `json:"calculated_at"`
	}
	result := make([]historyRow, len(rows))
	for i, row := range rows {
		t := ""
		if row.CalculatedAt.Valid {
			t = row.CalculatedAt.Time.Format("2006-01-02 15:04:05")
		}
		result[i] = historyRow{
			ID:             row.ID,
			RecipeID:       row.RecipeID,
			RecipeName:     row.RecipeName,
			BatchYield:     row.BatchYield,
			YieldUnit:      row.YieldUnit,
			IngredientCost: row.IngredientCost,
			LaborCost:      row.LaborCost,
			OverheadCost:   row.OverheadCost,
			TotalBatchCost: row.TotalBatchCost,
			CostPerUnit:    row.CostPerUnit,
			SuggestedPrice: row.SuggestedPrice,
			MarginPct:      row.MarginPct,
			CalculatedAt:   t,
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *COGSHandler) DeleteSnapshot(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.queries.DeleteCOGSSnapshot(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
