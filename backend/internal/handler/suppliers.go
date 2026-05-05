package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/krisnaadi/cogs-app/internal/db"
)

type SuppliersHandler struct {
	queries db.Querier
}

func NewSuppliersHandler(q db.Querier) *SuppliersHandler {
	return &SuppliersHandler{queries: q}
}

func (h *SuppliersHandler) Routes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", h.list)
		r.Post("/", h.create)
		r.Get("/{id}", h.get)
		r.Put("/{id}", h.update)
		r.Delete("/{id}", h.delete)
		r.Get("/{id}/ingredients", h.ingredients)
	}
}

type supplierRequest struct {
	Name    string  `json:"name"`
	Contact *string `json:"contact"`
}

type supplierResponse struct {
	ID      uuid.UUID `json:"id"`
	Name    string    `json:"name"`
	Contact *string   `json:"contact"`
}

func toSupplierResponse(s db.Supplier) supplierResponse {
	resp := supplierResponse{ID: s.ID, Name: s.Name}
	if s.Contact.Valid {
		resp.Contact = &s.Contact.String
	}
	return resp
}

func (h *SuppliersHandler) list(w http.ResponseWriter, r *http.Request) {
	suppliers, err := h.queries.ListSuppliers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	resp := make([]supplierResponse, len(suppliers))
	for i, s := range suppliers {
		resp[i] = toSupplierResponse(s)
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *SuppliersHandler) get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	s, err := h.queries.GetSupplier(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "supplier not found")
		return
	}
	writeJSON(w, http.StatusOK, toSupplierResponse(s))
}

func (h *SuppliersHandler) create(w http.ResponseWriter, r *http.Request) {
	var req supplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	params := db.CreateSupplierParams{Name: req.Name}
	if req.Contact != nil {
		params.Contact = pgtype.Text{String: *req.Contact, Valid: true}
	}
	s, err := h.queries.CreateSupplier(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toSupplierResponse(s))
}

func (h *SuppliersHandler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req supplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	params := db.UpdateSupplierParams{ID: id, Name: req.Name}
	if req.Contact != nil {
		params.Contact = pgtype.Text{String: *req.Contact, Valid: true}
	}
	s, err := h.queries.UpdateSupplier(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, toSupplierResponse(s))
}

func (h *SuppliersHandler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.queries.DeleteSupplier(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *SuppliersHandler) ingredients(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	items, err := h.queries.GetSupplierIngredients(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}
