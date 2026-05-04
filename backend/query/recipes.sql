-- name: ListRecipes :many
SELECT * FROM recipes WHERE is_sub_recipe = FALSE ORDER BY name;

-- name: ListSubRecipes :many
SELECT * FROM recipes WHERE is_sub_recipe = TRUE ORDER BY name;

-- name: ListAllRecipes :many
SELECT * FROM recipes ORDER BY name;

-- name: GetRecipe :one
SELECT * FROM recipes WHERE id = $1;

-- name: CreateRecipe :one
INSERT INTO recipes (name, category, batch_yield, yield_unit, is_sub_recipe)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateRecipe :one
UPDATE recipes
SET name = $2, category = $3, batch_yield = $4, yield_unit = $5, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteRecipe :exec
DELETE FROM recipes WHERE id = $1;

-- name: GetRecipeLines :many
SELECT
    rl.id,
    rl.recipe_id,
    rl.ingredient_id,
    rl.sub_recipe_id,
    rl.quantity,
    rl.unit,
    i.name           AS ingredient_name,
    i.unit           AS ingredient_unit,
    i.price_per_unit,
    i.waste_pct
FROM recipe_lines rl
LEFT JOIN ingredients i ON i.id = rl.ingredient_id
WHERE rl.recipe_id = $1;

-- name: CreateRecipeLine :one
INSERT INTO recipe_lines (recipe_id, ingredient_id, sub_recipe_id, quantity, unit)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: DeleteRecipeLines :exec
DELETE FROM recipe_lines WHERE recipe_id = $1;