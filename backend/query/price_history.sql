-- name: CreatePriceHistory :one
INSERT INTO price_history (ingredient_id, price_per_unit, supplier_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetPriceHistory :many
SELECT
  ph.id,
  ph.ingredient_id,
  ph.price_per_unit,
  ph.recorded_at,
  s.name AS supplier_name
FROM price_history ph
LEFT JOIN suppliers s ON s.id = ph.supplier_id
WHERE ph.ingredient_id = $1
ORDER BY ph.recorded_at DESC
LIMIT 30;

-- name: GetLatestPrice :one
SELECT price_per_unit FROM price_history
WHERE ingredient_id = $1
ORDER BY recorded_at DESC
LIMIT 1;