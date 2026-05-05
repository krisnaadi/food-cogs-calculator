const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
    if (!res.ok) {
        const error = await res.text()
        throw new Error(error || `HTTP ${res.status}`)
    }
    if (res.status === 204) return undefined as T
    return res.json()
}

export const ingredientsApi = {
    list: () => request<Ingredient[]>('/ingredients'),
    get: (id: string) => request<Ingredient>(`/ingredients/${id}`),
    create: (data: IngredientPayload) => request<Ingredient>('/ingredients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: IngredientPayload) => request<Ingredient>(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/ingredients/${id}`, { method: 'DELETE' }),
}

export const recipesApi = {
    list: () => request<Recipe[]>('/recipes'),
    get: (id: string) => request<Recipe>(`/recipes/${id}`),
    create: (data: RecipePayload) => request<Recipe>('/recipes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: RecipePayload) => request<Recipe>(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/recipes/${id}`, { method: 'DELETE' }),
}

export const overheadApi = {
    list: () => request<OverheadTemplate[]>('/cogs/overheads'),
    create: (data: OverheadTemplatePayload) => request<OverheadTemplate>('/cogs/overheads', { method: 'POST', body: JSON.stringify(data) }),
}

export const cogsApi = {
    calculate: (data: COGSPayload) => request<COGSResult>('/cogs/calculate', { method: 'POST', body: JSON.stringify(data) }),
}

// --- Types ---

export interface Ingredient {
    id: string
    name: string
    sku: string | null
    unit: string
    price_per_unit: number
    waste_pct: number
    supplier_id: string | null
}

export interface IngredientPayload {
    name: string
    sku?: string
    unit: string
    price_per_unit: number
    waste_pct: number
    supplier_id?: string
}

export interface RecipeLine {
    id: string
    ingredient_id: string | null
    sub_recipe_id: string | null
    ingredient_name: string | null
    ingredient_unit: string | null
    quantity: number
    unit: string
    price_per_unit: number
    waste_pct: number
}

export interface Recipe {
    id: string
    name: string
    category: string | null
    batch_yield: number
    yield_unit: string
    is_sub_recipe: boolean
    lines: RecipeLine[]
}

export interface RecipeLinePayload {
    ingredient_id?: string
    sub_recipe_id?: string
    quantity: number
    unit: string
}

export interface RecipePayload {
    name: string
    category?: string
    batch_yield: number
    yield_unit: string
    is_sub_recipe: boolean
    lines: RecipeLinePayload[]
}

export interface OverheadTemplate {
    id: string
    name: string
    packaging_cost: number
    utilities_cost: number
    other_fixed: number
}

export interface OverheadTemplatePayload {
    name: string
    packaging_cost: number
    utilities_cost: number
    other_fixed: number
}

export interface COGSPayload {
    recipe_id: string
    batch_size: number
    target_margin: number
    labor_cost: number
    overhead_cost: number
    overhead_id?: string
    save_snapshot: boolean
}

export interface COGSLineBreakdown {
    ingredient_id: string
    ingredient_name: string
    quantity: number
    unit: string
    price_per_unit: number
    waste_pct: number
    raw_cost: number
    adjusted_cost: number
    percentage: number
}

export interface COGSResult {
    recipe_id: string
    recipe_name: string
    batch_size: number
    batch_yield: number
    ingredient_cost: number
    labor_cost: number
    overhead_cost: number
    total_batch_cost: number
    cost_per_unit: number
    suggested_price: number
    margin_pct: number
    breakdown_by_line: COGSLineBreakdown[]
}