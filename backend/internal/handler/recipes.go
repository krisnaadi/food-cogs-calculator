package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/krisnaadi/cogs-app/internal/db"
)

func numericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
}

type RecipesHandler struct {
	queries db.Querier
}

func NewRecipesHandler(q db.Querier) *RecipesHandler {
	return &RecipesHandler{queries: q}
}

func (h *RecipesHandler) Routes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", h.list)
		r.Post("/", h.create)
		r.Get("/{id}", h.get)
		r.Put("/{id}", h.update)
		r.Delete("/{id}", h.delete)
	}
}

// --- request / response types ---

type recipeLineRequest struct {
	IngredientID *string `json:"ingredient_id"`
	SubRecipeID  *string `json:"sub_recipe_id"`
	Quantity     float64 `json:"quantity"`
	Unit         string  `json:"unit"`
}

type recipeRequest struct {
	Name        string              `json:"name"`
	Category    *string             `json:"category"`
	BatchYield  int32               `json:"batch_yield"`
	YieldUnit   string              `json:"yield_unit"`
	IsSubRecipe bool                `json:"is_sub_recipe"`
	Lines       []recipeLineRequest `json:"lines"`
}

type recipeLineResponse struct {
	ID             uuid.UUID `json:"id"`
	IngredientID   *string   `json:"ingredient_id"`
	SubRecipeID    *string   `json:"sub_recipe_id"`
	IngredientName *string   `json:"ingredient_name"`
	Quantity       float64   `json:"quantity"`
	Unit           string    `json:"unit"`
	PricePerUnit   float64   `json:"price_per_unit"`
	WastePct       float64   `json:"waste_pct"`
}

type recipeResponse struct {
	ID          uuid.UUID            `json:"id"`
	Name        string               `json:"name"`
	Category    *string              `json:"category"`
	BatchYield  int32                `json:"batch_yield"`
	YieldUnit   string               `json:"yield_unit"`
	IsSubRecipe bool                 `json:"is_sub_recipe"`
	Lines       []recipeLineResponse `json:"lines"`
}

func toRecipeResponse(r db.Recipe, lines []db.GetRecipeLinesRow) recipeResponse {
	resp := recipeResponse{
		ID:          r.ID,
		Name:        r.Name,
		BatchYield:  r.BatchYield,
		YieldUnit:   r.YieldUnit,
		IsSubRecipe: r.IsSubRecipe,
		Lines:       []recipeLineResponse{},
	}
	if r.Category.Valid {
		resp.Category = &r.Category.String
	}
	for _, l := range lines {
		line := recipeLineResponse{
			ID:       l.ID,
			Quantity: l.Quantity,
			Unit:     l.Unit,
		}
		if l.IngredientID.Valid {
			id, err := uuid.FromBytes(l.IngredientID.Bytes[:])
			if err == nil {
				s := id.String()
				line.IngredientID = &s
			}
		}
		if l.SubRecipeID.Valid {
			id, err := uuid.FromBytes(l.SubRecipeID.Bytes[:])
			if err == nil {
				s := id.String()
				line.SubRecipeID = &s
			}
		}
		if l.IngredientName.Valid {
			line.IngredientName = &l.IngredientName.String
		}
		line.PricePerUnit = numericToFloat(l.PricePerUnit)
		line.WastePct = numericToFloat(l.WastePct)
		resp.Lines = append(resp.Lines, line)
	}
	return resp
}

// --- handlers ---

func (h *RecipesHandler) list(w http.ResponseWriter, r *http.Request) {
	recipes, err := h.queries.ListRecipes(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	result := make([]recipeResponse, len(recipes))
	for i, rec := range recipes {
		lines, _ := h.queries.GetRecipeLines(r.Context(), rec.ID)
		result[i] = toRecipeResponse(rec, lines)
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *RecipesHandler) get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	rec, err := h.queries.GetRecipe(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "recipe not found")
		return
	}
	lines, _ := h.queries.GetRecipeLines(r.Context(), id)
	writeJSON(w, http.StatusOK, toRecipeResponse(rec, lines))
}

func (h *RecipesHandler) create(w http.ResponseWriter, r *http.Request) {
	var req recipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	params := db.CreateRecipeParams{
		Name:        req.Name,
		BatchYield:  req.BatchYield,
		YieldUnit:   req.YieldUnit,
		IsSubRecipe: req.IsSubRecipe,
	}
	if req.Category != nil {
		params.Category = pgtype.Text{String: *req.Category, Valid: true}
	}

	rec, err := h.queries.CreateRecipe(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// insert lines
	lines, err := h.insertLines(r, rec.ID, req.Lines)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, toRecipeResponse(rec, lines))
}

func (h *RecipesHandler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req recipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	params := db.UpdateRecipeParams{
		ID:         id,
		Name:       req.Name,
		BatchYield: req.BatchYield,
		YieldUnit:  req.YieldUnit,
	}
	if req.Category != nil {
		params.Category = pgtype.Text{String: *req.Category, Valid: true}
	}

	rec, err := h.queries.UpdateRecipe(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// replace all lines
	if err := h.queries.DeleteRecipeLines(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	lines, err := h.insertLines(r, id, req.Lines)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, toRecipeResponse(rec, lines))
}

func (h *RecipesHandler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	// lines cascade delete via FK
	if err := h.queries.DeleteRecipe(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *RecipesHandler) insertLines(r *http.Request, recipeID uuid.UUID, lines []recipeLineRequest) ([]db.GetRecipeLinesRow, error) {
	for _, l := range lines {
		params := db.CreateRecipeLineParams{
			RecipeID: recipeID,
			Quantity: l.Quantity,
			Unit:     l.Unit,
		}
		if l.IngredientID != nil {
			id, err := uuid.Parse(*l.IngredientID)
			if err == nil {
				params.IngredientID = pgtype.UUID{Bytes: id, Valid: true}
			}
		}
		if l.SubRecipeID != nil {
			id, err := uuid.Parse(*l.SubRecipeID)
			if err == nil {
				params.SubRecipeID = pgtype.UUID{Bytes: id, Valid: true}
			}
		}
		if _, err := h.queries.CreateRecipeLine(r.Context(), params); err != nil {
			return nil, err
		}
	}
	return h.queries.GetRecipeLines(r.Context(), recipeID)
}
