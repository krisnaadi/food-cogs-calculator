-- name: ListIngredients :many
SELECT * FROM ingredients ORDER BY name;

-- name: GetIngredient :one
SELECT * FROM ingredients WHERE id = $1;

-- name: CreateIngredient :one
INSERT INTO ingredients (name, sku, unit, price_per_unit, waste_pct, supplier_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateIngredient :one
UPDATE ingredients
SET name = $2, unit = $3, price_per_unit = $4, waste_pct = $5, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteIngredient :exec
DELETE FROM ingredients WHERE id = $1;