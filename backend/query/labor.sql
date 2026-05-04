-- name: ListLaborProfiles :many
SELECT * FROM labor_profiles ORDER BY role;

-- name: CreateLaborProfile :one
INSERT INTO labor_profiles (role, hourly_rate)
VALUES ($1, $2)
RETURNING *;

-- name: DeleteLaborProfile :exec
DELETE FROM labor_profiles WHERE id = $1;