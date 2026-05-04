package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/krisnaadi/cogs-app/internal/db"
)

type IngredientsHandler struct {
	queries db.Querier
}

func NewIngredientsHandler(q db.Querier) *IngredientsHandler {
	return &IngredientsHandler{queries: q}
}

func (h *IngredientsHandler) Routes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", h.list)
		r.Post("/", h.create)
		r.Get("/{id}", h.get)
		r.Put("/{id}", h.update)
		r.Delete("/{id}", h.delete)
	}
}

// --- request / response types ---

type ingredientRequest struct {
	Name         string  `json:"name"`
	Sku          *string `json:"sku"`
	Unit         string  `json:"unit"`
	PricePerUnit float64 `json:"price_per_unit"`
	WastePct     float64 `json:"waste_pct"`
	SupplierID   *string `json:"supplier_id"`
}

type ingredientResponse struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Sku          *string   `json:"sku"`
	Unit         string    `json:"unit"`
	PricePerUnit float64   `json:"price_per_unit"`
	WastePct     float64   `json:"waste_pct"`
	SupplierID   *string   `json:"supplier_id"`
}

func toIngredientResponse(i db.Ingredient) ingredientResponse {
	resp := ingredientResponse{
		ID:           i.ID,
		Name:         i.Name,
		Unit:         i.Unit,
		PricePerUnit: i.PricePerUnit,
		WastePct:     i.WastePct,
	}
	if i.Sku.Valid {
		resp.Sku = &i.Sku.String
	}
	if i.SupplierID.Valid {
		sid := i.SupplierID.Bytes
		u, err := uuid.FromBytes(sid[:])
		if err == nil {
			s := u.String()
			resp.SupplierID = &s
		}
	}
	return resp
}

// --- handlers ---

func (h *IngredientsHandler) list(w http.ResponseWriter, r *http.Request) {
	ingredients, err := h.queries.ListIngredients(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	resp := make([]ingredientResponse, len(ingredients))
	for i, ing := range ingredients {
		resp[i] = toIngredientResponse(ing)
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *IngredientsHandler) get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	ing, err := h.queries.GetIngredient(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "ingredient not found")
		return
	}
	writeJSON(w, http.StatusOK, toIngredientResponse(ing))
}

func (h *IngredientsHandler) create(w http.ResponseWriter, r *http.Request) {
	var req ingredientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Unit == "" {
		writeError(w, http.StatusBadRequest, "name and unit are required")
		return
	}

	params := db.CreateIngredientParams{
		Name:         req.Name,
		Unit:         req.Unit,
		PricePerUnit: req.PricePerUnit,
		WastePct:     req.WastePct,
	}
	if req.Sku != nil {
		params.Sku = pgtype.Text{String: *req.Sku, Valid: true}
	}
	if req.SupplierID != nil {
		sid, err := uuid.Parse(*req.SupplierID)
		if err == nil {
			params.SupplierID = pgtype.UUID{Bytes: sid, Valid: true}
		}
	}

	ing, err := h.queries.CreateIngredient(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toIngredientResponse(ing))
}

func (h *IngredientsHandler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req ingredientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	params := db.UpdateIngredientParams{
		ID:           id,
		Name:         req.Name,
		Unit:         req.Unit,
		PricePerUnit: req.PricePerUnit,
		WastePct:     req.WastePct,
	}

	ing, err := h.queries.UpdateIngredient(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, toIngredientResponse(ing))
}

func (h *IngredientsHandler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.queries.DeleteIngredient(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
