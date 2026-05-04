import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Modal from '@/components/Modal'
import { useIngredients, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from '@/hooks/useIngredients'
import type { Ingredient } from '@/lib/api'

// --- schema ---
const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    sku: z.string().optional(),
    unit: z.string().min(1, 'Unit is required'),
    price_per_unit: z.number().min(0, 'Must be >= 0'),
    waste_pct: z.number().min(0).max(99, 'Must be 0–99'),
})
type FormValues = z.infer<typeof schema>

// --- field component ---
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-stone-400 uppercase tracking-widest">{label}</label>
            {children}
            {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
    )
}

const inputCls = "bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors"

// --- ingredient form ---
function IngredientForm({
    defaultValues,
    onSubmit,
    loading,
}: {
    defaultValues?: Partial<FormValues>
    onSubmit: (v: FormValues) => void
    loading: boolean
}) {
    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultValues ?? { waste_pct: 0, price_per_unit: 0 },
    })

    const units = ['kg', 'g', 'ml', 'l', 'pcs', 'tbsp', 'tsp']

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field label="Name" error={errors.name?.message}>
                <input {...register('name')} className={inputCls} placeholder="e.g. Bread Flour" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="SKU (optional)" error={errors.sku?.message}>
                    <input {...register('sku')} className={inputCls} placeholder="e.g. ING-001" />
                </Field>
                <Field label="Unit" error={errors.unit?.message}>
                    <select {...register('unit')} className={inputCls}>
                        <option value="">Select unit</option>
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Price per unit (IDR)" error={errors.price_per_unit?.message}>
                    <input {...register('price_per_unit', { valueAsNumber: true })} type="number" step="0.01" className={inputCls} placeholder="0" />
                </Field>
                <Field label="Waste %" error={errors.waste_pct?.message}>
                    <input {...register('waste_pct', { valueAsNumber: true })} type="number" step="0.1" min="0" max="99" className={inputCls} placeholder="0" />
                </Field>
            </div>

            <p className="text-xs text-stone-500">
                Waste % accounts for shrinkage during prep. e.g. 5 means 5% is lost.
            </p>

            <button
                type="submit"
                disabled={loading}
                className="mt-1 bg-amber-400 text-stone-950 font-semibold text-sm py-2 rounded hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Saving…' : 'Save Ingredient'}
            </button>
        </form>
    )
}

// --- main page ---
export default function IngredientsPage() {
    const { data: ingredients = [], isLoading, isError } = useIngredients()
    const createMut = useCreateIngredient()
    const updateMut = useUpdateIngredient()
    const deleteMut = useDeleteIngredient()

    const [showCreate, setShowCreate] = useState(false)
    const [editing, setEditing] = useState<Ingredient | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<Ingredient | null>(null)

    const handleCreate = (values: FormValues) => {
        createMut.mutate(
            { ...values, waste_pct: values.waste_pct / 100 },
            { onSuccess: () => setShowCreate(false) }
        )
    }

    const handleUpdate = (values: FormValues) => {
        if (!editing) return
        updateMut.mutate(
            { id: editing.id, data: { ...values, waste_pct: values.waste_pct / 100 } },
            { onSuccess: () => setEditing(null) }
        )
    }

    const handleDelete = () => {
        if (!confirmDelete) return
        deleteMut.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })
    }

    const formatPrice = (n: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

    return (
        <div className="max-w-5xl">
            {/* header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-stone-100">Ingredients</h1>
                    <p className="text-sm text-stone-500 mt-1">Raw materials used in your recipes</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="bg-amber-400 text-stone-950 text-sm font-semibold px-4 py-2 rounded hover:bg-amber-300 transition-colors"
                >
                    + Add Ingredient
                </button>
            </div>

            {/* states */}
            {isLoading && (
                <div className="text-stone-500 text-sm">Loading ingredients…</div>
            )}
            {isError && (
                <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-4 py-3">
                    Failed to load ingredients. Is the backend running?
                </div>
            )}

            {/* table */}
            {!isLoading && !isError && (
                <div className="border border-stone-800 rounded-lg overflow-hidden">
                    {ingredients.length === 0 ? (
                        <div className="px-6 py-16 text-center text-stone-600 text-sm">
                            No ingredients yet. Add one to get started.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-stone-800 text-xs text-stone-500 uppercase tracking-widest">
                                    <th className="text-left px-4 py-3 font-medium">Name</th>
                                    <th className="text-left px-4 py-3 font-medium">SKU</th>
                                    <th className="text-left px-4 py-3 font-medium">Unit</th>
                                    <th className="text-right px-4 py-3 font-medium">Price / unit</th>
                                    <th className="text-right px-4 py-3 font-medium">Waste %</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {ingredients.map((ing, i) => (
                                    <tr
                                        key={ing.id}
                                        className={`border-b border-stone-800/50 hover:bg-stone-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-stone-900/30'
                                            }`}
                                    >
                                        <td className="px-4 py-3 text-stone-100 font-medium">{ing.name}</td>
                                        <td className="px-4 py-3 text-stone-500">{ing.sku ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className="bg-stone-800 text-stone-300 text-xs px-2 py-0.5 rounded">
                                                {ing.unit}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-amber-400 font-medium tabular-nums">
                                            {formatPrice(ing.price_per_unit)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-stone-400 tabular-nums">
                                            {(ing.waste_pct * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setEditing(ing)}
                                                    className="text-xs text-stone-400 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-stone-800"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(ing)}
                                                    className="text-xs text-stone-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-stone-800"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* footer count */}
            {ingredients.length > 0 && (
                <p className="text-xs text-stone-600 mt-3">{ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}</p>
            )}

            {/* create modal */}
            {showCreate && (
                <Modal title="New Ingredient" onClose={() => setShowCreate(false)}>
                    <IngredientForm onSubmit={handleCreate} loading={createMut.isPending} />
                </Modal>
            )}

            {/* edit modal */}
            {editing && (
                <Modal title="Edit Ingredient" onClose={() => setEditing(null)}>
                    <IngredientForm
                        defaultValues={{
                            name: editing.name,
                            sku: editing.sku ?? undefined,
                            unit: editing.unit,
                            price_per_unit: editing.price_per_unit,
                            waste_pct: +(editing.waste_pct * 100).toFixed(2),
                        }}
                        onSubmit={handleUpdate}
                        loading={updateMut.isPending}
                    />
                </Modal>
            )}

            {/* delete confirm modal */}
            {confirmDelete && (
                <Modal title="Delete Ingredient" onClose={() => setConfirmDelete(null)}>
                    <p className="text-sm text-stone-300 mb-6">
                        Delete <span className="text-white font-semibold">{confirmDelete.name}</span>?
                        This cannot be undone and will fail if the ingredient is used in any recipe.
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