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
		r.Get("/{id}/price-history", h.priceHistory)
	}
}

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
	SupplierName *string   `json:"supplier_name"`
}

type priceHistoryResponse struct {
	ID           uuid.UUID `json:"id"`
	PricePerUnit float64   `json:"price_per_unit"`
	RecordedAt   string    `json:"recorded_at"`
	SupplierName *string   `json:"supplier_name"`
}

func (h *IngredientsHandler) list(w http.ResponseWriter, r *http.Request) {
	ingredients, err := h.queries.ListIngredients(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// fetch supplier names in one pass
	supplierNames := map[string]string{}
	suppliers, _ := h.queries.ListSuppliers(r.Context())
	for _, s := range suppliers {
		supplierNames[s.ID.String()] = s.Name
	}

	resp := make([]ingredientResponse, len(ingredients))
	for i, ing := range ingredients {
		resp[i] = toIngredientResponse(ing, supplierNames)
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
	writeJSON(w, http.StatusOK, toIngredientResponse(ing, nil))
}

func (h *IngredientsHandler) create(w http.ResponseWriter, r *http.Request) {
	var req ingredientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
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
	var supplierPgID pgtype.UUID
	if req.SupplierID != nil {
		sid, err := uuid.Parse(*req.SupplierID)
		if err == nil {
			params.SupplierID = pgtype.UUID{Bytes: sid, Valid: true}
			supplierPgID = pgtype.UUID{Bytes: sid, Valid: true}
		}
	}

	ing, err := h.queries.CreateIngredient(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// log initial price
	h.queries.CreatePriceHistory(r.Context(), db.CreatePriceHistoryParams{ //nolint
		IngredientID: ing.ID,
		PricePerUnit: ing.PricePerUnit,
		SupplierID:   supplierPgID,
	})

	writeJSON(w, http.StatusCreated, toIngredientResponse(ing, nil))
}

func (h *IngredientsHandler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req ingredientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	// check if price changed before updating
	existing, err := h.queries.GetIngredient(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "ingredient not found")
		return
	}
	priceChanged := existing.PricePerUnit != req.PricePerUnit

	params := db.UpdateIngredientParams{
		ID:           id,
		Name:         req.Name,
		Unit:         req.Unit,
		PricePerUnit: req.PricePerUnit,
		WastePct:     req.WastePct,
	}
	if req.Sku != nil {
		params.Sku = pgtype.Text{String: *req.Sku, Valid: true}
	}
	var supplierPgID pgtype.UUID
	if req.SupplierID != nil {
		sid, err := uuid.Parse(*req.SupplierID)
		if err == nil {
			supplierPgID = pgtype.UUID{Bytes: sid, Valid: true}
		}
	}
	params.SupplierID = supplierPgID

	ing, err := h.queries.UpdateIngredient(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// only log price history when price actually changed
	if priceChanged {
		h.queries.CreatePriceHistory(r.Context(), db.CreatePriceHistoryParams{ //nolint
			IngredientID: ing.ID,
			PricePerUnit: ing.PricePerUnit,
			SupplierID:   supplierPgID,
		})
	}

	writeJSON(w, http.StatusOK, toIngredientResponse(ing, nil))
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

func (h *IngredientsHandler) priceHistory(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	rows, err := h.queries.GetPriceHistory(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	resp := make([]priceHistoryResponse, len(rows))
	for i, row := range rows {
		r := priceHistoryResponse{
			ID:           row.ID,
			PricePerUnit: row.PricePerUnit,
			RecordedAt:   row.RecordedAt.Time.Format("2006-01-02"),
		}
		if row.SupplierName.Valid {
			r.SupplierName = &row.SupplierName.String
		}
		resp[i] = r
	}
	writeJSON(w, http.StatusOK, resp)
}

func toIngredientResponse(i db.Ingredient, supplierNames map[string]string) ingredientResponse {
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
		sid, err := uuid.FromBytes(i.SupplierID.Bytes[:])
		if err == nil {
			s := sid.String()
			resp.SupplierID = &s
			if supplierNames != nil {
				if name, ok := supplierNames[s]; ok {
					resp.SupplierName = &name
				}
			}
		}
	}
	return resp
}
