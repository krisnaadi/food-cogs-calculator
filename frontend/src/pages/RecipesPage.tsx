import { useState, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Modal from '@/components/Modal'
import { useRecipes, useCreateRecipe, useUpdateRecipe, useDeleteRecipe } from '@/hooks/useRecipes'
import { useIngredients } from '@/hooks/useIngredients'
import type { Recipe } from '@/lib/api'

// ---------------------------------------------------------------
// Schema
// ---------------------------------------------------------------
const lineSchema = z.object({
    type: z.enum(['ingredient', 'sub_recipe']),
    ingredient_id: z.string().optional(),
    sub_recipe_id: z.string().optional(),
    quantity: z.number().min(0.001, 'Must be > 0'),
    unit: z.string().min(1, 'Required'),
})

const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    category: z.string().optional(),
    batch_yield: z.number().min(1, 'Must be >= 1'),
    yield_unit: z.string().min(1, 'Required'),
    is_sub_recipe: z.boolean(),
    lines: z.array(lineSchema).min(1, 'Add at least one ingredient'),
})

type FormValues = z.infer<typeof schema>

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
const inputCls = 'bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors w-full'
const selectCls = inputCls

function Field({ label, error, children, className = '' }: {
    label: string; error?: string; children: React.ReactNode; className?: string
}) {
    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <label className="text-xs text-stone-400 uppercase tracking-widest">{label}</label>
            {children}
            {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
    )
}

function formatIDR(n: number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
    }).format(n)
}

// ---------------------------------------------------------------
// Live cost preview — calculated client-side from selected lines
// ---------------------------------------------------------------
function CostPreview({ lines, ingredients, batchYield }: {
    lines: FormValues['lines']
    ingredients: { id: string; name: string; price_per_unit: number; waste_pct: number }[]
    batchYield: number
}) {
    const total = useMemo(() => {
        return lines.reduce((sum, line) => {
            if (line.type !== 'ingredient' || !line.ingredient_id) return sum
            const ing = ingredients.find(i => i.id === line.ingredient_id)
            if (!ing) return sum
            const raw = line.quantity * ing.price_per_unit
            const adjusted = ing.waste_pct > 0 ? raw / (1 - ing.waste_pct) : raw
            return sum + adjusted
        }, 0)
    }, [lines, ingredients])

    const perUnit = batchYield > 0 ? total / batchYield : 0

    if (total === 0) return null

    return (
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
                <p className="text-xs text-amber-400/70 uppercase tracking-widest">Est. ingredient cost</p>
                <p className="text-lg font-bold text-amber-400 tabular-nums">{formatIDR(total)}</p>
                <p className="text-xs text-amber-400/60">per batch</p>
            </div>
            {batchYield > 1 && (
                <div className="text-right">
                    <p className="text-xs text-amber-400/70 uppercase tracking-widest">Per unit</p>
                    <p className="text-lg font-bold text-amber-400 tabular-nums">{formatIDR(perUnit)}</p>
                    <p className="text-xs text-amber-400/60">÷ {batchYield} {batchYield === 1 ? 'unit' : 'units'}</p>
                </div>
            )}
        </div>
    )
}

// ---------------------------------------------------------------
// Recipe Form
// ---------------------------------------------------------------
function RecipeForm({
    defaultValues,
    onSubmit,
    loading,
}: {
    defaultValues?: Partial<FormValues>
    onSubmit: (v: FormValues) => void
    loading: boolean
}) {
    const { data: ingredients = [] } = useIngredients()
    const { data: allRecipes = [] } = useRecipes()
    const subRecipes = allRecipes.filter(r => r.is_sub_recipe)

    const { register, control, handleSubmit, watch, setValue, formState: { errors } } =
        useForm<FormValues>({
            resolver: zodResolver(schema),
            defaultValues: defaultValues ?? {
                batch_yield: 1,
                yield_unit: 'pcs',
                is_sub_recipe: false,
                lines: [],
            },
        })

    const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
    const watchedLines = watch('lines')
    const watchedYield = watch('batch_yield')
    const watchedCategory = watch('category')

    const categories = ['Bread', 'Cake', 'Cookie', 'Pastry', 'Beverage', 'Savory', 'Other']
    const units = ['kg', 'g', 'ml', 'l', 'pcs', 'tbsp', 'tsp', 'slice', 'loaf']

    const addLine = (type: 'ingredient' | 'sub_recipe') => {
        append({ type, ingredient_id: '', sub_recipe_id: '', quantity: 0, unit: 'g' })
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* name + category */}
            <div className="grid grid-cols-2 gap-3">
                <Field label="Recipe name" error={errors.name?.message} className="col-span-2">
                    <input {...register('name')} className={inputCls} placeholder="e.g. Matcha Chiffon Cake 20cm" />
                </Field>

                <Field label="Category" error={errors.category?.message}>
                    <select
                        value={watchedCategory ?? ''}
                        onChange={e => setValue('category', e.target.value)}
                        className={selectCls}
                    >
                        <option value="">No category</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </Field>

                <Field label="Is sub-recipe?">
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input type="checkbox" {...register('is_sub_recipe')}
                            className="w-4 h-4 accent-amber-400" />
                        <span className="text-sm text-stone-400">
                            This is a base (e.g. frosting, dough)
                        </span>
                    </label>
                </Field>
            </div>

            {/* yield */}
            <div className="grid grid-cols-2 gap-3">
                <Field label="Batch yield" error={errors.batch_yield?.message}>
                    <input
                        {...register('batch_yield', { valueAsNumber: true })}
                        type="number" min="1"
                        className={inputCls} placeholder="12"
                    />
                </Field>
                <Field label="Yield unit" error={errors.yield_unit?.message}>
                    <select {...register('yield_unit')} className={selectCls}>
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </Field>
            </div>

            {/* live cost preview */}
            <CostPreview
                lines={watchedLines}
                ingredients={ingredients}
                batchYield={watchedYield}
            />

            {/* ingredient lines */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-stone-400 uppercase tracking-widest">Ingredient Lines</span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => addLine('ingredient')}
                            className="text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded transition-colors"
                        >
                            + Ingredient
                        </button>
                        {subRecipes.length > 0 && (
                            <button
                                type="button"
                                onClick={() => addLine('sub_recipe')}
                                className="text-xs bg-stone-800 hover:bg-stone-700 text-amber-400 px-3 py-1.5 rounded transition-colors"
                            >
                                + Sub-recipe
                            </button>
                        )}
                    </div>
                </div>

                {errors.lines?.root?.message && (
                    <p className="text-xs text-red-400 mb-2">{errors.lines.root.message}</p>
                )}
                {typeof errors.lines?.message === 'string' && (
                    <p className="text-xs text-red-400 mb-2">{errors.lines.message}</p>
                )}

                {fields.length === 0 && (
                    <div className="border border-dashed border-stone-700 rounded-lg px-4 py-8 text-center text-stone-600 text-sm">
                        No ingredients yet. Click "+ Ingredient" to add one.
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    {fields.map((field, index) => {
                        const lineType = watchedLines[index]?.type
                        const lineErrors = errors.lines?.[index]

                        return (
                            <div
                                key={field.id}
                                className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-start bg-stone-800/50 rounded-lg px-3 py-3 border border-stone-700/50"
                            >
                                {/* ingredient / sub-recipe selector */}
                                <div>
                                    {lineType === 'ingredient' ? (
                                        <select
                                            {...register(`lines.${index}.ingredient_id`)}
                                            className={selectCls}
                                        >
                                            <option value="">Select ingredient…</option>
                                            {ingredients.map(i => (
                                                <option key={i.id} value={i.id}>
                                                    {i.name} ({i.unit})
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select
                                            {...register(`lines.${index}.sub_recipe_id`)}
                                            className={`${selectCls} border-amber-400/40`}
                                        >
                                            <option value="">Select sub-recipe…</option>
                                            {subRecipes.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {(lineErrors?.ingredient_id || lineErrors?.sub_recipe_id) && (
                                        <span className="text-xs text-red-400">Select one</span>
                                    )}
                                </div>

                                {/* quantity */}
                                <div>
                                    <input
                                        {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                                        type="number"
                                        step="0.001"
                                        placeholder="Qty"
                                        className={inputCls}
                                    />
                                    {lineErrors?.quantity && (
                                        <span className="text-xs text-red-400">{lineErrors.quantity.message}</span>
                                    )}
                                </div>

                                {/* unit */}
                                <div>
                                    <select {...register(`lines.${index}.unit`)} className={selectCls}>
                                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>

                                {/* remove */}
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    className="mt-1 text-stone-600 hover:text-red-400 transition-colors text-lg leading-none"
                                    title="Remove line"
                                >
                                    ×
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="mt-1 bg-amber-400 text-stone-950 font-semibold text-sm py-2 rounded hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Saving…' : 'Save Recipe'}
            </button>
        </form>
    )
}

// ---------------------------------------------------------------
// Recipe Card
// ---------------------------------------------------------------
function RecipeCard({
    recipe,
    onEdit,
    onDelete,
}: {
    recipe: Recipe
    onEdit: () => void
    onDelete: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    const totalCost = recipe.lines.reduce((sum, l) => {
        const raw = l.quantity * l.price_per_unit
        const adj = l.waste_pct > 0 ? raw / (1 - l.waste_pct) : raw
        return sum + adj
    }, 0)
    const perUnit = recipe.batch_yield > 0 ? totalCost / recipe.batch_yield : 0

    return (
        <div className="border border-stone-800 rounded-lg overflow-hidden hover:border-stone-700 transition-colors">
            {/* header row */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="text-stone-500 hover:text-stone-300 transition-colors text-xs w-4"
                    >
                        {expanded ? '▼' : '▶'}
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-stone-100 font-medium text-sm">{recipe.name}</span>
                            {recipe.is_sub_recipe && (
                                <span className="text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded">
                                    sub-recipe
                                </span>
                            )}
                            {recipe.category && (
                                <span className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded">
                                    {recipe.category}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                            {recipe.batch_yield} {recipe.yield_unit} · {recipe.lines.length} ingredient{recipe.lines.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {totalCost > 0 && (
                        <div className="text-right">
                            <p className="text-xs text-stone-500">ingredient cost</p>
                            <p className="text-sm font-semibold text-amber-400 tabular-nums">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(perUnit)}
                                <span className="text-xs font-normal text-stone-500"> /unit</span>
                            </p>
                        </div>
                    )}
                    <div className="flex gap-1">
                        <button
                            onClick={onEdit}
                            className="text-xs text-stone-400 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-stone-800"
                        >
                            Edit
                        </button>
                        <button
                            onClick={onDelete}
                            className="text-xs text-stone-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-stone-800"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* expanded lines */}
            {expanded && recipe.lines.length > 0 && (
                <div className="border-t border-stone-800">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-stone-500 uppercase tracking-widest border-b border-stone-800">
                                <th className="text-left px-5 py-2 font-medium">Ingredient</th>
                                <th className="text-right px-4 py-2 font-medium">Qty</th>
                                <th className="text-left px-2 py-2 font-medium">Unit</th>
                                <th className="text-right px-4 py-2 font-medium">Price/unit</th>
                                <th className="text-right px-4 py-2 font-medium">Waste</th>
                                <th className="text-right px-5 py-2 font-medium">Line cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recipe.lines.map(line => {
                                const raw = line.quantity * line.price_per_unit
                                const adj = line.waste_pct > 0 ? raw / (1 - line.waste_pct) : raw
                                return (
                                    <tr key={line.id} className="border-b border-stone-800/40 hover:bg-stone-800/20">
                                        <td className="px-5 py-2 text-stone-300">{line.ingredient_name ?? '—'}</td>
                                        <td className="px-4 py-2 text-right tabular-nums text-stone-400">{line.quantity}</td>
                                        <td className="px-2 py-2 text-stone-500">{line.unit}</td>
                                        <td className="px-4 py-2 text-right tabular-nums text-stone-400">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(line.price_per_unit)}
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                                            {(line.waste_pct * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-5 py-2 text-right tabular-nums text-amber-400 font-medium">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(adj)}
                                        </td>
                                    </tr>
                                )
                            })}
                            <tr className="bg-stone-800/40">
                                <td colSpan={5} className="px-5 py-2 text-right text-xs text-stone-500 uppercase tracking-widest">
                                    Total batch
                                </td>
                                <td className="px-5 py-2 text-right tabular-nums text-amber-400 font-bold">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalCost)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------
export default function RecipesPage() {
    const { data: recipes = [], isLoading, isError } = useRecipes()
    const createMut = useCreateRecipe()
    const updateMut = useUpdateRecipe()
    const deleteMut = useDeleteRecipe()

    const [showCreate, setShowCreate] = useState(false)
    const [editing, setEditing] = useState<Recipe | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null)

    const toPayload = (values: FormValues) => ({
        name: values.name,
        category: values.category || undefined,
        batch_yield: values.batch_yield,
        yield_unit: values.yield_unit,
        is_sub_recipe: values.is_sub_recipe,
        lines: values.lines.map(l => ({
            ingredient_id: l.type === 'ingredient' ? l.ingredient_id : undefined,
            sub_recipe_id: l.type === 'sub_recipe' ? l.sub_recipe_id : undefined,
            quantity: l.quantity,
            unit: l.unit,
        })),
    })

    const handleCreate = (values: FormValues) => {
        createMut.mutate(toPayload(values), { onSuccess: () => setShowCreate(false) })
    }

    const handleUpdate = (values: FormValues) => {
        if (!editing) return
        updateMut.mutate(
            { id: editing.id, data: toPayload(values) },
            { onSuccess: () => setEditing(null) }
        )
    }

    const handleDelete = () => {
        if (!confirmDelete) return
        deleteMut.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })
    }

    const toFormValues = (recipe: Recipe): Partial<FormValues> => ({
        name: recipe.name,
        category: recipe.category ?? undefined,
        batch_yield: recipe.batch_yield,
        yield_unit: recipe.yield_unit,
        is_sub_recipe: recipe.is_sub_recipe,
        lines: recipe.lines.map(l => ({
            type: l.ingredient_id ? 'ingredient' : 'sub_recipe',
            ingredient_id: l.ingredient_id ?? '',
            sub_recipe_id: l.sub_recipe_id ?? '',
            quantity: l.quantity,
            unit: l.unit,
        })),
    })

    const mainRecipes = recipes.filter(r => !r.is_sub_recipe)
    const subRecipes = recipes.filter(r => r.is_sub_recipe)

    return (
        <div className="max-w-5xl">
            {/* header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-stone-100">Recipes</h1>
                    <p className="text-sm text-stone-500 mt-1">Build recipes from your ingredient master</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="bg-amber-400 text-stone-950 text-sm font-semibold px-4 py-2 rounded hover:bg-amber-300 transition-colors"
                >
                    + New Recipe
                </button>
            </div>

            {isLoading && <p className="text-stone-500 text-sm">Loading recipes…</p>}
            {isError && (
                <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-4 py-3">
                    Failed to load recipes. Is the backend running?
                </div>
            )}

            {/* main recipes */}
            {!isLoading && !isError && (
                <div className="flex flex-col gap-6">
                    {mainRecipes.length === 0 ? (
                        <div className="border border-dashed border-stone-800 rounded-lg px-6 py-16 text-center text-stone-600 text-sm">
                            No recipes yet. Add ingredients first, then build your first recipe.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {mainRecipes.map(r => (
                                <RecipeCard
                                    key={r.id}
                                    recipe={r}
                                    onEdit={() => setEditing(r)}
                                    onDelete={() => setConfirmDelete(r)}
                                />
                            ))}
                        </div>
                    )}

                    {/* sub-recipes section */}
                    {subRecipes.length > 0 && (
                        <div>
                            <h2 className="text-xs text-stone-500 uppercase tracking-widest mb-3">
                                Sub-recipes / Bases
                            </h2>
                            <div className="flex flex-col gap-2">
                                {subRecipes.map(r => (
                                    <RecipeCard
                                        key={r.id}
                                        recipe={r}
                                        onEdit={() => setEditing(r)}
                                        onDelete={() => setConfirmDelete(r)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* create modal */}
            {showCreate && (
                <Modal title="New Recipe" onClose={() => setShowCreate(false)}>
                    <RecipeForm onSubmit={handleCreate} loading={createMut.isPending} />
                </Modal>
            )}

            {/* edit modal */}
            {editing && (
                <Modal title="Edit Recipe" onClose={() => setEditing(null)}>
                    <RecipeForm
                        defaultValues={toFormValues(editing)}
                        onSubmit={handleUpdate}
                        loading={updateMut.isPending}
                    />
                </Modal>
            )}

            {/* delete confirm */}
            {confirmDelete && (
                <Modal title="Delete Recipe" onClose={() => setConfirmDelete(null)}>
                    <p className="text-sm text-stone-300 mb-6">
                        Delete <span className="text-white font-semibold">{confirmDelete.name}</span>?
                        This will also remove all its ingredient lines.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-4 py-2 text-sm text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={deleteMut.isPending}
                            className="px-4 py-2 text-sm bg-red-500 text-white font-semibold rounded hover:bg-red-400 disabled:opacity-50 transition-colors"
                        >
                            {deleteMut.isPending ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}