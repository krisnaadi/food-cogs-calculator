-- name: CreateCOGSSnapshot :one
INSERT INTO cogs_snapshots (
  recipe_id, overhead_id,
  ingredient_cost, labor_cost, overhead_cost,
  total_batch_cost, cost_per_unit, suggested_price, margin_pct, notes
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: ListCOGSHistory :many
SELECT
  cs.id,
  cs.recipe_id,
  cs.ingredient_cost,
  cs.labor_cost,
  cs.overhead_cost,
  cs.total_batch_cost,
  cs.cost_per_unit,
  cs.suggested_price,
  cs.margin_pct,
  cs.notes,
  cs.calculated_at,
  r.name       AS recipe_name,
  r.batch_yield,
  r.yield_unit
FROM cogs_snapshots cs
JOIN recipes r ON r.id = cs.recipe_id
ORDER BY cs.calculated_at DESC
LIMIT 100;

-- name: ListCOGSHistoryByRecipe :many
SELECT
  cs.id,
  cs.recipe_id,
  cs.ingredient_cost,
  cs.labor_cost,
  cs.overhead_cost,
  cs.total_batch_cost,
  cs.cost_per_unit,
  cs.suggested_price,
  cs.margin_pct,
  cs.notes,
  cs.calculated_at,
  r.name       AS recipe_name,
  r.batch_yield,
  r.yield_unit
FROM cogs_snapshots cs
JOIN recipes r ON r.id = cs.recipe_id
WHERE cs.recipe_id = $1
ORDER BY cs.calculated_at DESC;

-- name: DeleteCOGSSnapshot :exec
DELETE FROM cogs_snapshots WHERE id = $1;