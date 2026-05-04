-- name: ListOverheadTemplates :many
SELECT * FROM overhead_templates ORDER BY name;

-- name: GetOverheadTemplate :one
SELECT * FROM overhead_templates WHERE id = $1;

-- name: CreateOverheadTemplate :one
INSERT INTO overhead_templates (name, packaging_cost, utilities_cost, other_fixed)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateOverheadTemplate :one
UPDATE overhead_templates
SET name = $2, packaging_cost = $3, utilities_cost = $4, other_fixed = $5
WHERE id = $1
RETURNING *;

-- name: DeleteOverheadTemplate :exec
DELETE FROM overhead_templates WHERE id = $1;