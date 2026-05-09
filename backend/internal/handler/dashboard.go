package handler

import (
	"net/http"

	"github.com/krisnaadi/cogs-app/internal/db"
)

type DashboardHandler struct {
	queries db.Querier
}

func NewDashboardHandler(q db.Querier) *DashboardHandler {
	return &DashboardHandler{queries: q}
}

func (h *DashboardHandler) Stats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.queries.GetDashboardStats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *DashboardHandler) TopIngredients(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.GetTopIngredientsByCost(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (h *DashboardHandler) RecentSnapshots(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.GetRecentSnapshots(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	type row struct {
		ID             interface{} `json:"id"`
		RecipeName     string      `json:"recipe_name"`
		CostPerUnit    float64     `json:"cost_per_unit"`
		SuggestedPrice float64     `json:"suggested_price"`
		MarginPct      float64     `json:"margin_pct"`
		CalculatedAt   string      `json:"calculated_at"`
	}
	result := make([]row, len(rows))
	for i, r := range rows {
		t := ""
		if r.CalculatedAt.Valid {
			t = r.CalculatedAt.Time.Format("2006-01-02 15:04")
		}
		result[i] = row{
			ID:             r.ID,
			RecipeName:     r.RecipeName,
			CostPerUnit:    r.CostPerUnit,
			SuggestedPrice: r.SuggestedPrice,
			MarginPct:      r.MarginPct,
			CalculatedAt:   t,
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *DashboardHandler) IngredientUsageReport(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.GetIngredientUsageReport(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rows)
}
