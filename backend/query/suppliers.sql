-- name: ListSuppliers :many
SELECT * FROM suppliers ORDER BY name;

-- name: GetSupplier :one
SELECT * FROM suppliers WHERE id = $1;

-- name: CreateSupplier :one
INSERT INTO suppliers (name, contact)
VALUES ($1, $2)
RETURNING *;

-- name: UpdateSupplier :one
UPDATE suppliers
SET name = $2, contact = $3
WHERE id = $1
RETURNING *;

-- name: DeleteSupplier :exec
DELETE FROM suppliers WHERE id = $1;

-- name: GetSupplierIngredients :many
SELECT * FROM ingredients WHERE supplier_id = $1 ORDER BY name;