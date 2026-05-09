-- name: ListLaborProfiles :many
SELECT * FROM labor_profiles ORDER BY role;

-- name: GetLaborProfile :one
SELECT * FROM labor_profiles WHERE id = $1;

-- name: CreateLaborProfile :one
INSERT INTO labor_profiles (role, hourly_rate)
VALUES ($1, $2)
RETURNING *;

-- name: UpdateLaborProfile :one
UPDATE labor_profiles
SET role = $2, hourly_rate = $3
WHERE id = $1
RETURNING *;

-- name: DeleteLaborProfile :exec
DELETE FROM labor_profiles WHERE id = $1;