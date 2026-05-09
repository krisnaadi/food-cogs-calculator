package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/krisnaadi/cogs-app/internal/db"
)

type LaborHandler struct {
	queries db.Querier
}

func NewLaborHandler(q db.Querier) *LaborHandler {
	return &LaborHandler{queries: q}
}

func (h *LaborHandler) Routes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", h.list)
		r.Post("/", h.create)
		r.Put("/{id}", h.update)
		r.Delete("/{id}", h.delete)
	}
}

type laborRequest struct {
	Role       string  `json:"role"`
	HourlyRate float64 `json:"hourly_rate"`
}

func (h *LaborHandler) list(w http.ResponseWriter, r *http.Request) {
	profiles, err := h.queries.ListLaborProfiles(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, profiles)
}

func (h *LaborHandler) create(w http.ResponseWriter, r *http.Request) {
	var req laborRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.Role == "" {
		writeError(w, http.StatusBadRequest, "role is required")
		return
	}
	p, err := h.queries.CreateLaborProfile(r.Context(), db.CreateLaborProfileParams{
		Role: req.Role, HourlyRate: req.HourlyRate,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *LaborHandler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req laborRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	p, err := h.queries.UpdateLaborProfile(r.Context(), db.UpdateLaborProfileParams{
		ID: id, Role: req.Role, HourlyRate: req.HourlyRate,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *LaborHandler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.queries.DeleteLaborProfile(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
