package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/krisnaadi/cogs-app/internal/db"
)

type ProductionHandler struct {
	queries db.Querier
}

func NewProductionHandler(q db.Querier) *ProductionHandler {
	return &ProductionHandler{queries: q}
}

func (h *ProductionHandler) Routes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", h.list)
		r.Post("/", h.create)
		r.Delete("/{id}", h.delete)
	}
}

type productionRequest struct {
	RecipeID             string  `json:"recipe_id"`
	BatchSize            int     `json:"batch_size"`
	ActualIngredientCost float64 `json:"actual_ingredient_cost"`
	ActualYield          float64 `json:"actual_yield"`
	Notes                *string `json:"notes"`
}

type productionResponse struct {
	ID                   uuid.UUID `json:"id"`
	RecipeID             uuid.UUID `json:"recipe_id"`
	RecipeName           string    `json:"recipe_name"`
	BatchSize            int       `json:"batch_size"`
	ActualIngredientCost float64   `json:"actual_ingredient_cost"`
	ActualYield          float64   `json:"actual_yield"`
	ExpectedYield        int32     `json:"expected_yield"`
	YieldUnit            string    `json:"yield_unit"`
	YieldVariance        float64   `json:"yield_variance"` // actual - expected
	CostPerActualUnit    float64   `json:"cost_per_actual_unit"`
	ProducedAt           string    `json:"produced_at"`
	Notes                *string   `json:"notes"`
}

type productionRow struct {
	ID                   uuid.UUID
	RecipeID             uuid.UUID
	RecipeName           string
	BatchSize            int32
	ActualIngredientCost float64
	ActualYield          float64
	ExpectedYield        int32
	YieldUnit            string
	ProducedAt           pgtype.Timestamptz
	Notes                pgtype.Text
}

func fromListRow(r db.ListProductionLogsRow) productionRow {
	return productionRow{
		ID:                   r.ID,
		RecipeID:             r.RecipeID,
		RecipeName:           r.RecipeName,
		BatchSize:            r.BatchSize,
		ActualIngredientCost: r.ActualIngredientCost,
		ActualYield:          r.ActualYield,
		ExpectedYield:        r.ExpectedYield,
		YieldUnit:            r.YieldUnit,
		ProducedAt:           r.ProducedAt,
		Notes:                r.Notes,
	}
}

func fromByRecipeRow(r db.ListProductionLogsByRecipeRow) productionRow {
	return productionRow{
		ID:                   r.ID,
		RecipeID:             r.RecipeID,
		RecipeName:           r.RecipeName,
		BatchSize:            r.BatchSize,
		ActualIngredientCost: r.ActualIngredientCost,
		ActualYield:          r.ActualYield,
		ExpectedYield:        r.ExpectedYield,
		YieldUnit:            r.YieldUnit,
		ProducedAt:           r.ProducedAt,
		Notes:                r.Notes,
	}
}

func toProductionResponse(row productionRow) productionResponse {
	expected := float64(row.ExpectedYield) * float64(row.BatchSize)
	actual := row.ActualYield
	variance := actual - expected

	costPerUnit := float64(0)
	if actual > 0 {
		costPerUnit = row.ActualIngredientCost / actual
	}

	t := ""
	if row.ProducedAt.Valid {
		t = row.ProducedAt.Time.Format("2006-01-02 15:04")
	}

	resp := productionResponse{
		ID:                   row.ID,
		RecipeID:             row.RecipeID,
		RecipeName:           row.RecipeName,
		BatchSize:            int(row.BatchSize),
		ActualIngredientCost: row.ActualIngredientCost,
		ActualYield:          actual,
		ExpectedYield:        row.ExpectedYield,
		YieldUnit:            row.YieldUnit,
		YieldVariance:        variance,
		CostPerActualUnit:    costPerUnit,
		ProducedAt:           t,
	}
	if row.Notes.Valid {
		resp.Notes = &row.Notes.String
	}
	return resp
}

func (h *ProductionHandler) list(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.ListProductionLogs(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	result := make([]productionResponse, len(rows))
	for i, row := range rows {
		result[i] = toProductionResponse(fromListRow(row))
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ProductionHandler) create(w http.ResponseWriter, r *http.Request) {
	var req productionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	recipeID, err := uuid.Parse(req.RecipeID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid recipe_id")
		return
	}

	params := db.CreateProductionLogParams{
		RecipeID:             recipeID,
		BatchSize:            int32(req.BatchSize),
		ActualIngredientCost: req.ActualIngredientCost,
		ActualYield:          req.ActualYield,
	}
	if req.Notes != nil {
		params.Notes = pgtype.Text{String: *req.Notes, Valid: true}
	}

	log, err := h.queries.CreateProductionLog(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// fetch with recipe name for response
	rows, _ := h.queries.ListProductionLogsByRecipe(r.Context(), log.RecipeID)
	for _, row := range rows {
		if row.ID == log.ID {
			writeJSON(w, http.StatusCreated, toProductionResponse(fromByRecipeRow(row)))
			return
		}
	}
	writeJSON(w, http.StatusCreated, log)
}

func (h *ProductionHandler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.queries.DeleteProductionLog(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
