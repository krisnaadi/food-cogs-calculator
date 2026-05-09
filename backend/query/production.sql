-- name: CreateProductionLog :one
INSERT INTO production_logs (recipe_id, batch_size, actual_ingredient_cost, actual_yield, notes)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListProductionLogs :many
SELECT
  pl.id,
  pl.recipe_id,
  pl.batch_size,
  pl.actual_ingredient_cost,
  pl.actual_yield,
  pl.produced_at,
  pl.notes,
  r.name        AS recipe_name,
  r.batch_yield AS expected_yield,
  r.yield_unit
FROM production_logs pl
JOIN recipes r ON r.id = pl.recipe_id
ORDER BY pl.produced_at DESC
LIMIT 100;

-- name: ListProductionLogsByRecipe :many
SELECT
  pl.id,
  pl.recipe_id,
  pl.batch_size,
  pl.actual_ingredient_cost,
  pl.actual_yield,
  pl.produced_at,
  pl.notes,
  r.name        AS recipe_name,
  r.batch_yield AS expected_yield,
  r.yield_unit
FROM production_logs pl
JOIN recipes r ON r.id = pl.recipe_id
WHERE pl.recipe_id = $1
ORDER BY pl.produced_at DESC;

-- name: DeleteProductionLog :exec
DELETE FROM production_logs WHERE id = $1;