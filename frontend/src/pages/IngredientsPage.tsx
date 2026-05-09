import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Modal from '@/components/Modal'
import { useIngredients, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from '@/hooks/useIngredients'
import { useSuppliers } from '@/hooks/useSuppliers'
import { ingredientsApi } from '@/lib/api'
import type { Ingredient } from '@/lib/api'
import { exportCSV } from '@/lib/csv'

const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    sku: z.string().optional(),
    unit: z.string().min(1, 'Unit is required'),
    price_per_unit: z.number().min(0),
    waste_pct: z.number().min(0).max(99),
    supplier_id: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const inputCls = 'bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors w-full'
const selectCls = inputCls

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-stone-400 uppercase tracking-widest">{label}</label>
            {children}
            {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
    )
}

function IngredientForm({ defaultValues, onSubmit, loading }: {
    defaultValues?: Partial<FormValues>
    onSubmit: (v: FormValues) => void
    loading: boolean
}) {
    const { data: suppliers = [] } = useSuppliers()
    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultValues ?? { waste_pct: 0, price_per_unit: 0 },
    })
    const units = ['kg', 'g', 'mg', 'l', 'ml', 'pcs', 'tbsp', 'tsp']

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field label="Name" error={errors.name?.message}>
                <input {...register('name')} className={inputCls} placeholder="e.g. Bread Flour" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="SKU (optional)">
                    <input {...register('sku')} className={inputCls} placeholder="ING-001" />
                </Field>
                <Field label="Unit" error={errors.unit?.message}>
                    <select {...register('unit')} className={selectCls}>
                        <option value="">Select unit</option>
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Price per unit (IDR)" error={errors.price_per_unit?.message}>
                    <input {...register('price_per_unit', { valueAsNumber: true })} type="number" step="0.01" className={inputCls} />
                </Field>
                <Field label="Waste %" error={errors.waste_pct?.message}>
                    <input {...register('waste_pct', { valueAsNumber: true })} type="number" step="0.1" min="0" max="99" className={inputCls} />
                </Field>
            </div>

            <Field label="Supplier (optional)">
                <select {...register('supplier_id')} className={selectCls}>
                    <option value="">No supplier</option>
                    {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </Field>

            <p className="text-xs text-stone-500">
                Price changes are automatically logged to price history.
            </p>

            <button
                type="submit" disabled={loading}
                className="bg-amber-400 text-stone-950 font-semibold text-sm py-2 rounded hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Saving…' : 'Save Ingredient'}
            </button>
        </form>
    )
}

function PriceHistoryModal({ ingredient, onClose }: { ingredient: Ingredient; onClose: () => void }) {
    const { data = [], isLoading } = useQuery({
        queryKey: ['price-history', ingredient.id],
        queryFn: () => ingredientsApi.priceHistory(ingredient.id),
    })

    const fmt = (n: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

    const chartData = [...data].reverse().map(d => ({
        date: d.recorded_at,
        price: d.price_per_unit,
    }))

    const priceDelta = data.length >= 2
        ? data[0].price_per_unit - data[data.length - 1].price_per_unit
        : 0

    return (
        <Modal title={`Price History — ${ingredient.name}`} onClose={onClose}>
            {isLoading && <p className="text-stone-500 text-sm">Loading…</p>}

            {!isLoading && data.length === 0 && (
                <p className="text-stone-500 text-sm">No price history yet.</p>
            )}

            {!isLoading && data.length > 0 && (
                <div className="flex flex-col gap-5">
                    {/* summary */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-stone-800 rounded-lg px-3 py-3">
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Current</p>
                            <p className="text-base font-bold text-amber-400 tabular-nums">{fmt(data[0].price_per_unit)}</p>
                        </div>
                        <div className="bg-stone-800 rounded-lg px-3 py-3">
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Lowest</p>
                            <p className="text-base font-bold text-stone-300 tabular-nums">
                                {fmt(Math.min(...data.map(d => d.price_per_unit)))}
                            </p>
                        </div>
                        <div className={`rounded-lg px-3 py-3 ${priceDelta > 0 ? 'bg-red-400/10' : priceDelta < 0 ? 'bg-green-400/10' : 'bg-stone-800'}`}>
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Change</p>
                            <p className={`text-base font-bold tabular-nums ${priceDelta > 0 ? 'text-red-400' : priceDelta < 0 ? 'text-green-400' : 'text-stone-300'}`}>
                                {priceDelta > 0 ? '+' : ''}{fmt(priceDelta)}
                            </p>
                        </div>
                    </div>

                    {/* chart */}
                    {chartData.length > 1 && (
                        <div>
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-3">Price over time</p>
                            <ResponsiveContainer width="100%" height={150}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                                    <XAxis dataKey="date" tick={{ fill: '#78716c', fontSize: 10 }} />
                                    <YAxis tick={{ fill: '#78716c', fontSize: 10 }} tickFormatter={v => fmt(v)} width={80} />
                                    <Tooltip
                                        formatter={(v: number) => [fmt(v), 'Price']}
                                        contentStyle={{ background: '#1c1917', border: '1px solid #292524', borderRadius: 6, fontSize: 12 }}
                                    />
                                    <Line type="monotone" dataKey="price" stroke="#fbbf24" strokeWidth={2} dot={{ fill: '#fbbf24', r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* table */}
                    <div className="border border-stone-700 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-stone-700 text-stone-500 uppercase tracking-widest">
                                    <th className="text-left px-4 py-2 font-medium">Date</th>
                                    <th className="text-right px-4 py-2 font-medium">Price / {ingredient.unit}</th>
                                    <th className="text-left px-4 py-2 font-medium">Supplier</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row, i) => (
                                    <tr key={row.id} className={`border-b border-stone-800/50 ${i === 0 ? 'bg-amber-400/5' : ''}`}>
                                        <td className="px-4 py-2 text-stone-400 tabular-nums">{row.recorded_at}</td>
                                        <td className="px-4 py-2 text-right tabular-nums text-amber-400 font-medium">
                                            {fmt(row.price_per_unit)}
                                            {i === 0 && <span className="ml-1 text-xs text-amber-400/50">(current)</span>}
                                        </td>
                                        <td className="px-4 py-2 text-stone-500">{row.supplier_name ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    )
}

export default function IngredientsPage() {
    const { data: ingredients = [], isLoading, isError } = useIngredients()
    const createMut = useCreateIngredient()
    const updateMut = useUpdateIngredient()
    const deleteMut = useDeleteIngredient()

    const [showCreate, setShowCreate] = useState(false)
    const [editing, setEditing] = useState<Ingredient | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<Ingredient | null>(null)
    const [viewHistory, setViewHistory] = useState<Ingredient | null>(null)

    const handleCreate = (v: FormValues) =>
        createMut.mutate(
            { ...v, waste_pct: v.waste_pct / 100 },
            { onSuccess: () => setShowCreate(false) }
        )

    const handleUpdate = (v: FormValues) => {
        if (!editing) return
        updateMut.mutate(
            { id: editing.id, data: { ...v, waste_pct: v.waste_pct / 100 } },
            { onSuccess: () => setEditing(null) }
        )
    }

    const fmt = (n: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

    return (
        <div className="max-w-5xl">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => exportCSV(
                        'ingredients.csv',
                        ['Name', 'SKU', 'Unit', 'Price/Unit (IDR)', 'Waste %', 'Supplier'],
                        ingredients.map(i => [
                            i.name, i.sku, i.unit, i.price_per_unit,
                            (i.waste_pct * 100).toFixed(2),
                            i.supplier_name,
                        ])
                    )}
                    className="text-xs text-stone-400 hover:text-stone-200 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded transition-colors"
                >
                    ↓ Export CSV
                </button>
                <button onClick={() => setShowCreate(true)}
                    className="bg-amber-400 text-stone-950 text-sm font-semibold px-4 py-2 rounded hover:bg-amber-300 transition-colors">
                    + Add Ingredient
                </button>
            </div>

            {isLoading && <p className="text-stone-500 text-sm">Loading…</p>}
            {isError && (
                <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-4 py-3">
                    Failed to load ingredients.
                </div>
            )}

            {!isLoading && !isError && (
                <div className="border border-stone-800 rounded-lg overflow-hidden">
                    {ingredients.length === 0 ? (
                        <div className="px-6 py-16 text-center text-stone-600 text-sm">No ingredients yet.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-stone-800 text-xs text-stone-500 uppercase tracking-widest">
                                    <th className="text-left px-4 py-3 font-medium">Name</th>
                                    <th className="text-left px-4 py-3 font-medium">Supplier</th>
                                    <th className="text-left px-4 py-3 font-medium">Unit</th>
                                    <th className="text-right px-4 py-3 font-medium">Price / unit</th>
                                    <th className="text-right px-4 py-3 font-medium">Waste %</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {ingredients.map((ing, i) => (
                                    <tr key={ing.id} className={`border-b border-stone-800/50 hover:bg-stone-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-stone-900/30'}`}>
                                        <td className="px-4 py-3">
                                            <p className="text-stone-100 font-medium">{ing.name}</p>
                                            {ing.sku && <p className="text-xs text-stone-600 mt-0.5">{ing.sku}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-stone-500 text-xs">
                                            {ing.supplier_name ?? <span className="text-stone-700">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-stone-800 text-stone-300 text-xs px-2 py-0.5 rounded">{ing.unit}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-amber-400 font-medium tabular-nums">
                                            {fmt(ing.price_per_unit)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-stone-400 tabular-nums">
                                            {(ing.waste_pct * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => setViewHistory(ing)}
                                                    className="text-xs text-stone-500 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-stone-800">
                                                    History
                                                </button>
                                                <button onClick={() => setEditing(ing)}
                                                    className="text-xs text-stone-400 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-stone-800">
                                                    Edit
                                                </button>
                                                <button onClick={() => setConfirmDelete(ing)}
                                                    className="text-xs text-stone-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-stone-800">
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

            {ingredients.length > 0 && (
                <p className="text-xs text-stone-600 mt-3">{ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}</p>
            )}

            {showCreate && (
                <Modal title="New Ingredient" onClose={() => setShowCreate(false)}>
                    <IngredientForm onSubmit={handleCreate} loading={createMut.isPending} />
                </Modal>
            )}

            {editing && (
                <Modal title="Edit Ingredient" onClose={() => setEditing(null)}>
                    <IngredientForm
                        defaultValues={{
                            name: editing.name,
                            sku: editing.sku ?? '',
                            unit: editing.unit,
                            price_per_unit: editing.price_per_unit,
                            waste_pct: +(editing.waste_pct * 100).toFixed(2),
                            supplier_id: editing.supplier_id ?? '',
                        }}
                        onSubmit={handleUpdate}
                        loading={updateMut.isPending}
                    />
                </Modal>
            )}

            {confirmDelete && (
                <Modal title="Delete Ingredient" onClose={() => setConfirmDelete(null)}>
                    <p className="text-sm text-stone-300 mb-6">
                        Delete <span className="text-white font-semibold">{confirmDelete.name}</span>?
                        This will fail if the ingredient is used in any recipe.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800 transition-colors">Cancel</button>
                        <button onClick={() => deleteMut.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })}
                            disabled={deleteMut.isPending}
                            className="px-4 py-2 text-sm bg-red-500 text-white font-semibold rounded hover:bg-red-400 disabled:opacity-50 transition-colors">
                            {deleteMut.isPending ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                    </div>
                </Modal>
            )}

            {viewHistory && (
                <PriceHistoryModal ingredient={viewHistory} onClose={() => setViewHistory(null)} />
            )}
        </div>
    )
}