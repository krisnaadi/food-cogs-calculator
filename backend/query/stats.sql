-- name: GetDashboardStats :one
SELECT
  (SELECT COUNT(*) FROM ingredients)         AS ingredient_count,
  (SELECT COUNT(*) FROM recipes WHERE is_sub_recipe = FALSE) AS recipe_count,
  (SELECT COUNT(*) FROM suppliers)           AS supplier_count,
  (SELECT COUNT(*) FROM cogs_snapshots)      AS snapshot_count;

-- name: GetTopIngredientsByCost :many
SELECT
  i.id,
  i.name,
  i.unit,
  i.price_per_unit,
  COUNT(rl.id) AS used_in_recipes
FROM ingredients i
LEFT JOIN recipe_lines rl ON rl.ingredient_id = i.id
GROUP BY i.id
ORDER BY i.price_per_unit DESC
LIMIT 8;

-- name: GetRecentSnapshots :many
SELECT
  cs.id,
  cs.cost_per_unit,
  cs.suggested_price,
  cs.margin_pct,
  cs.calculated_at,
  r.name AS recipe_name
FROM cogs_snapshots cs
JOIN recipes r ON r.id = cs.recipe_id
ORDER BY cs.calculated_at DESC
LIMIT 5;

-- name: GetIngredientUsageReport :many
SELECT
  i.id,
  i.name,
  i.unit,
  i.price_per_unit,
  i.waste_pct,
  COUNT(DISTINCT rl.recipe_id) AS recipe_count,
  COALESCE(
    STRING_AGG(DISTINCT r.name, ', ' ORDER BY r.name),
    ''
  ) AS used_in_recipes,
  SUM(rl.quantity) AS total_quantity_used
FROM ingredients i
LEFT JOIN recipe_lines rl ON rl.ingredient_id = i.id
LEFT JOIN recipes r ON r.id = rl.recipe_id
GROUP BY i.id
ORDER BY recipe_count DESC, i.price_per_unit DESC;