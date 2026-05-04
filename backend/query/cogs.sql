-- name: CreateCOGSSnapshot :one
INSERT INTO cogs_snapshots (
  recipe_id, overhead_id,
  ingredient_cost, labor_cost, overhead_cost,
  total_batch_cost, cost_per_unit, suggested_price, margin_pct
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListCOGSSnapshots :many
SELECT
  cs.*,
  r.name AS recipe_name
FROM cogs_snapshots cs
JOIN recipes r ON r.id = cs.recipe_id
ORDER BY cs.calculated_at DESC
LIMIT 50;

-- name: ListCOGSSnapshotsByRecipe :many
SELECT * FROM cogs_snapshots
WHERE recipe_id = $1
ORDER BY calculated_at DESC;