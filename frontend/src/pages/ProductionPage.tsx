import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/Modal'
import { productionApi, recipesApi } from '@/lib/api'
import type { ProductionLog } from '@/lib/api'

const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const schema = z.object({
    recipe_id: z.string().min(1, 'Select a recipe'),
    batch_size: z.number().min(1),
    actual_ingredient_cost: z.number().min(0),
    actual_yield: z.number().min(0.001, 'Must be > 0'),
    notes: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const inputCls = 'bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors w-full'
const selectCls = inputCls

function Field({ label, hint, error, className, children }: {
    label: string; hint?: string; error?: string; className?: string; children: React.ReactNode
}) {
    return (
        <div className={`flex flex-col gap-1 ${className || ''}`.trim()}>
            <label className="text-xs text-stone-400 uppercase tracking-widest">{label}</label>
            {hint && <p className="text-xs text-stone-600">{hint}</p>}
            {children}
            {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
    )
}

function VarianceBadge({ variance, unit }: { variance: number; unit: string }) {
    if (Math.abs(variance) < 0.01) return <span className="text-xs text-stone-500">On target</span>
    const good = variance >= 0
    return (
        <span className={`text-xs font-medium ${good ? 'text-green-400' : 'text-red-400'}`}>
            {good ? '+' : ''}{variance.toFixed(1)} {unit}
            <span className="text-stone-600 font-normal ml-1">vs expected</span>
        </span>
    )
}

function LogForm({ onSubmit, loading }: { onSubmit: (v: FormValues) => void; loading: boolean }) {
    const { data: recipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: recipesApi.list })
    const mainRecipes = recipes.filter(r => !r.is_sub_recipe)

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { batch_size: 1, actual_ingredient_cost: 0, actual_yield: 0 },
    })

    const watchedRecipe = watch('recipe_id')
    const watchedBatch = watch('batch_size')
    const selectedRecipe = mainRecipes.find(r => r.id === watchedRecipe)

    // auto-fill expected yield when recipe + batch changes
    const expectedYield = selectedRecipe
        ? selectedRecipe.batch_yield * watchedBatch
        : null

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Recipe" error={errors.recipe_id?.message} className="col-span-2">
                    <select {...register('recipe_id')} className={selectCls}>
                        <option value="">Select recipe…</option>
                        {mainRecipes.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </Field>

                <Field label="Batch size" error={errors.batch_size?.message}>
                    <input {...register('batch_size', { valueAsNumber: true })} type="number" min="1" className={inputCls} />
                </Field>

                <Field label="Actual ingredient cost (IDR)" error={errors.actual_ingredient_cost?.message}>
                    <input {...register('actual_ingredient_cost', { valueAsNumber: true })} type="number" min="0" className={inputCls} />
                </Field>
            </div>

            <Field
                label="Actual yield"
                hint={expectedYield ? `Expected: ${expectedYield} ${selectedRecipe?.yield_unit ?? ''}` : undefined}
                error={errors.actual_yield?.message}
            >
                <div className="flex items-center gap-2">
                    <input {...register('actual_yield', { valueAsNumber: true })} type="number" step="0.1" min="0" className={inputCls} />
                    {selectedRecipe && (
                        <button
                            type="button"
                            onClick={() => setValue('actual_yield', expectedYield ?? 0)}
                            className="shrink-0 text-xs bg-stone-700 hover:bg-stone-600 text-stone-300 px-3 py-2 rounded transition-colors"
                        >
                            Use expected
                        </button>
                    )}
                </div>
            </Field>

            <Field label="Notes (optional)">
                <textarea {...register('notes')} className={`${inputCls} resize-none`} rows={2} placeholder="e.g. oven temp issue, new supplier flour" />
            </Field>

            <button type="submit" disabled={loading}
                className="bg-amber-400 text-stone-950 font-semibold text-sm py-2 rounded hover:bg-amber-300 disabled:opacity-50 transition-colors">
                {loading ? 'Saving…' : 'Log Production Run'}
            </button>
        </form>
    )
}

export default function ProductionPage() {
    const qc = useQueryClient()
    const { data: logs = [], isLoading } = useQuery({
        queryKey: ['production'],
        queryFn: productionApi.list,
    })

    const createMut = useMutation({
        mutationFn: productionApi.create,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['production'] })
            qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
            setShowCreate(false)
        },
    })

    const deleteMut = useMutation({
        mutationFn: productionApi.delete,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['production'] }),
    })

    const [showCreate, setShowCreate] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<ProductionLog | null>(null)
    const [filterRecipe, setFilterRecipe] = useState('')

    const { data: recipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: recipesApi.list })
    const mainRecipes = recipes.filter(r => !r.is_sub_recipe)

    const filtered = filterRecipe ? logs.filter(l => l.recipe_id === filterRecipe) : logs

    // per-recipe waste analysis
    const avgVariance = (recipeId: string) => {
        const rows = logs.filter(l => l.recipe_id === recipeId)
        if (rows.length === 0) return null
        const sum = rows.reduce((a, b) => a + b.yield_variance, 0)
        return sum / rows.length
    }

    return (
        <div className="max-w-5xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-stone-100">Production Log</h1>
                    <p className="text-sm text-stone-500 mt-1">
                        Track actual runs to calibrate your COGS estimates
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={filterRecipe}
                        onChange={e => setFilterRecipe(e.target.value)}
                        className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-amber-400 transition-colors"
                    >
                        <option value="">All recipes</option>
                        {mainRecipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-amber-400 text-stone-950 text-sm font-semibold px-4 py-2 rounded hover:bg-amber-300 transition-colors"
                    >
                        + Log Run
                    </button>
                </div>
            </div>

            {/* summary when filtering */}
            {filterRecipe && (() => {
                const avg = avgVariance(filterRecipe)
                const runs = filtered.length
                const avgCost = runs > 0
                    ? filtered.reduce((a, b) => a + b.cost_per_actual_unit, 0) / runs
                    : 0
                return (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-stone-900 border border-stone-800 rounded-lg px-5 py-4">
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Total runs</p>
                            <p className="text-2xl font-bold text-stone-100">{runs}</p>
                        </div>
                        <div className="bg-stone-900 border border-stone-800 rounded-lg px-5 py-4">
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Avg cost/unit</p>
                            <p className="text-2xl font-bold text-amber-400 tabular-nums">{IDR(avgCost)}</p>
                        </div>
                        <div className={`rounded-lg px-5 py-4 border ${avg === null ? 'bg-stone-900 border-stone-800'
                                : avg >= 0 ? 'bg-green-400/10 border-green-400/30'
                                    : 'bg-red-400/10 border-red-400/30'
                            }`}>
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Avg yield variance</p>
                            <p className={`text-2xl font-bold tabular-nums ${avg === null ? 'text-stone-400'
                                    : avg >= 0 ? 'text-green-400'
                                        : 'text-red-400'
                                }`}>
                                {avg === null ? '—' : `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}`}
                            </p>
                        </div>
                    </div>
                )
            })()}

            {isLoading && <p className="text-stone-500 text-sm">Loading…</p>}

            {!isLoading && filtered.length === 0 ? (
                <div className="border border-dashed border-stone-800 rounded-lg px-6 py-16 text-center text-stone-600 text-sm">
                    No production runs logged yet. Hit "+ Log Run" after each batch.
                </div>
            ) : (
                <div className="border border-stone-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-stone-800 text-xs text-stone-500 uppercase tracking-widest">
                                <th className="text-left px-5 py-3 font-medium">Recipe</th>
                                <th className="text-right px-4 py-3 font-medium">Batches</th>
                                <th className="text-right px-4 py-3 font-medium">Actual yield</th>
                                <th className="text-left px-4 py-3 font-medium">Variance</th>
                                <th className="text-right px-4 py-3 font-medium">Ing. cost</th>
                                <th className="text-right px-4 py-3 font-medium">Cost / unit</th>
                                <th className="text-left px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((log, i) => (
                                <tr key={log.id} className={`border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-stone-900/30'}`}>
                                    <td className="px-5 py-3">
                                        <p className="text-stone-100 font-medium">{log.recipe_name}</p>
                                        {log.notes && <p className="text-xs text-stone-600 mt-0.5 truncate max-w-[200px]">{log.notes}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-stone-400">{log.batch_size}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-stone-300">
                                        {log.actual_yield} {log.yield_unit}
                                        <p className="text-xs text-stone-600">exp. {log.expected_yield * log.batch_size}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <VarianceBadge variance={log.yield_variance} unit={log.yield_unit} />
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-stone-300">
                                        {IDR(log.actual_ingredient_cost)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-amber-400 font-semibold">
                                        {IDR(log.cost_per_actual_unit)}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-stone-500 tabular-nums whitespace-nowrap">
                                        {log.produced_at}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => setConfirmDelete(log)}
                                            className="text-xs text-stone-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-stone-800"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-5 py-3 border-t border-stone-800">
                        <p className="text-xs text-stone-600">{filtered.length} run{filtered.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            )}

            {showCreate && (
                <Modal title="Log Production Run" onClose={() => setShowCreate(false)}>
                    <LogForm onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
                </Modal>
            )}

            {confirmDelete && (
                <Modal title="Delete Log" onClose={() => setConfirmDelete(null)}>
                    <p className="text-sm text-stone-300 mb-6">
                        Delete this production run for <span className="text-white font-semibold">{confirmDelete.recipe_name}</span> on {confirmDelete.produced_at.slice(0, 10)}?
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800 transition-colors">Cancel</button>
                        <button
                            onClick={() => deleteMut.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })}
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