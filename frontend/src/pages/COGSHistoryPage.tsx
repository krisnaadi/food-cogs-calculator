import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { historyApi, recipesApi } from '@/lib/api'
import type { COGSHistoryRow } from '@/lib/api'
import Modal from '@/components/Modal'

const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function CostBar({ ingredient, labor, overhead }: {
    ingredient: number; labor: number; overhead: number
}) {
    const total = ingredient + labor + overhead
    if (total === 0) return null
    const iPct = (ingredient / total) * 100
    const lPct = (labor / total) * 100
    const oPct = (overhead / total) * 100
    return (
        <div className="flex h-1.5 rounded-full overflow-hidden gap-px w-32">
            <div style={{ width: `${iPct}%` }} className="bg-amber-400" title={`Ingredients ${iPct.toFixed(0)}%`} />
            <div style={{ width: `${lPct}%` }} className="bg-stone-500" title={`Labor ${lPct.toFixed(0)}%`} />
            <div style={{ width: `${oPct}%` }} className="bg-stone-600" title={`Overhead ${oPct.toFixed(0)}%`} />
        </div>
    )
}

export default function COGSHistoryPage() {
    const qc = useQueryClient()
    const { data: history = [], isLoading, isError } = useQuery({
        queryKey: ['cogs-history'],
        queryFn: historyApi.list,
    })
    const { data: recipes = [] } = useQuery({
        queryKey: ['recipes'],
        queryFn: recipesApi.list,
    })

    const deleteMut = useMutation({
        mutationFn: (id: string) => historyApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-history'] }),
    })

    const [confirmDelete, setConfirmDelete] = useState<COGSHistoryRow | null>(null)
    const [filterRecipe, setFilterRecipe] = useState('')
    const [expanded, setExpanded] = useState<string | null>(null)

    const filtered = filterRecipe
        ? history.filter(h => h.recipe_id === filterRecipe)
        : history

    // group by recipe for trend: pick first (latest) and last (oldest) in filtered
    const trend = (recipeId: string) => {
        const rows = history
            .filter(h => h.recipe_id === recipeId)
            .sort((a, b) => a.calculated_at.localeCompare(b.calculated_at))
        if (rows.length < 2) return null
        const oldest = rows[0].cost_per_unit
        const latest = rows[rows.length - 1].cost_per_unit
        const pct = ((latest - oldest) / oldest) * 100
        return { pct, up: pct > 0 }
    }

    const mainRecipes = recipes.filter(r => !r.is_sub_recipe)

    return (
        <div className="max-w-6xl">
            {/* header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-stone-100">COGS History</h1>
                    <p className="text-sm text-stone-500 mt-1">
                        Past calculations — track how costs change over time
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={filterRecipe}
                        onChange={e => setFilterRecipe(e.target.value)}
                        className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-amber-400 transition-colors"
                    >
                        <option value="">All recipes</option>
                        {mainRecipes.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                    {filterRecipe && (
                        <button
                            onClick={() => setFilterRecipe('')}
                            className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* summary cards — only when filtering by recipe */}
            {filterRecipe && filtered.length >= 2 && (() => {
                const sorted = [...filtered].sort((a, b) => a.calculated_at.localeCompare(b.calculated_at))
                const oldest = sorted[0]
                const latest = sorted[sorted.length - 1]
                const delta = latest.cost_per_unit - oldest.cost_per_unit
                const deltaPct = (delta / oldest.cost_per_unit) * 100
                return (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-stone-900 border border-stone-800 rounded-lg px-5 py-4">
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">First recorded</p>
                            <p className="text-lg font-bold text-stone-100 tabular-nums">{IDR(oldest.cost_per_unit)}</p>
                            <p className="text-xs text-stone-500 mt-0.5">{oldest.calculated_at.slice(0, 10)}</p>
                        </div>
                        <div className="bg-stone-900 border border-stone-800 rounded-lg px-5 py-4">
                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Latest</p>
                            <p className="text-lg font-bold text-stone-100 tabular-nums">{IDR(latest.cost_per_unit)}</p>
                            <p className="text-xs text-stone-500 mt-0.5">{latest.calculated_at.slice(0, 10)}</p>
                        </div>
                        <div className={`rounded-lg px-5 py-4 border ${delta > 0
                                ? 'bg-red-400/10 border-red-400/30'
                                : delta < 0
                                    ? 'bg-green-400/10 border-green-400/30'
                                    : 'bg-stone-900 border-stone-800'
                            }`}>
                            <p className={`text-xs uppercase tracking-widest mb-1 ${delta > 0 ? 'text-red-400/70' : delta < 0 ? 'text-green-400/70' : 'text-stone-500'
                                }`}>Cost trend</p>
                            <p className={`text-lg font-bold tabular-nums ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-stone-300'
                                }`}>
                                {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(deltaPct).toFixed(1)}%
                            </p>
                            <p className={`text-xs mt-0.5 ${delta > 0 ? 'text-red-400/60' : delta < 0 ? 'text-green-400/60' : 'text-stone-500'}`}>
                                {delta > 0 ? 'Cost increased' : delta < 0 ? 'Cost decreased' : 'No change'} over {sorted.length} snapshots
                            </p>
                        </div>
                    </div>
                )
            })()}

            {isLoading && <p className="text-stone-500 text-sm">Loading history…</p>}
            {isError && (
                <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-4 py-3">
                    Failed to load history.
                </div>
            )}

            {!isLoading && !isError && (
                filtered.length === 0 ? (
                    <div className="border border-dashed border-stone-800 rounded-lg px-6 py-16 text-center text-stone-600 text-sm">
                        No snapshots yet. Run a COGS calculation with "Save snapshot" checked.
                    </div>
                ) : (
                    <div className="border border-stone-800 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-stone-800 text-xs text-stone-500 uppercase tracking-widest">
                                    <th className="text-left px-5 py-3 font-medium">Recipe</th>
                                    <th className="text-right px-4 py-3 font-medium">Cost / unit</th>
                                    <th className="text-right px-4 py-3 font-medium">Suggested price</th>
                                    <th className="text-right px-4 py-3 font-medium">Margin</th>
                                    <th className="px-4 py-3 font-medium">Cost split</th>
                                    <th className="text-left px-4 py-3 font-medium">Trend</th>
                                    <th className="text-left px-4 py-3 font-medium">Date</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((row, i) => {
                                    const t = trend(row.recipe_id)
                                    const isOpen = expanded === row.id
                                    return (
                                        <>
                                            <tr
                                                key={row.id}
                                                className={`border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors cursor-pointer ${i % 2 === 0 ? '' : 'bg-stone-900/30'
                                                    }`}
                                                onClick={() => setExpanded(isOpen ? null : row.id)}
                                            >
                                                <td className="px-5 py-3">
                                                    <p className="text-stone-100 font-medium">{row.recipe_name}</p>
                                                    <p className="text-xs text-stone-500 mt-0.5">
                                                        {row.batch_yield} {row.yield_unit}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-amber-400 font-semibold">
                                                    {IDR(row.cost_per_unit)}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-stone-300">
                                                    {IDR(row.suggested_price)}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-stone-400">
                                                    {(row.margin_pct * 100).toFixed(0)}%
                                                </td>
                                                <td className="px-4 py-3">
                                                    <CostBar
                                                        ingredient={row.ingredient_cost}
                                                        labor={row.labor_cost}
                                                        overhead={row.overhead_cost}
                                                    />
                                                    <p className="text-xs text-stone-600 mt-1">
                                                        {IDR(row.total_batch_cost)} total
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {t ? (
                                                        <span className={`text-xs font-medium ${t.up ? 'text-red-400' : 'text-green-400'}`}>
                                                            {t.up ? '▲' : '▼'} {Math.abs(t.pct).toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-stone-600">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-stone-500 tabular-nums whitespace-nowrap">
                                                    {row.calculated_at.slice(0, 16).replace('T', ' ')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setConfirmDelete(row) }}
                                                        className="text-xs text-stone-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-stone-800"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* expanded detail row */}
                                            {isOpen && (
                                                <tr key={`${row.id}-detail`} className="border-b border-stone-800">
                                                    <td colSpan={8} className="px-5 py-4 bg-stone-900/60">
                                                        <div className="grid grid-cols-4 gap-4 text-xs">
                                                            <div>
                                                                <p className="text-stone-500 uppercase tracking-widest mb-1">Ingredients</p>
                                                                <p className="text-amber-400 font-semibold tabular-nums">{IDR(row.ingredient_cost)}</p>
                                                                <p className="text-stone-600">
                                                                    {row.total_batch_cost > 0
                                                                        ? ((row.ingredient_cost / row.total_batch_cost) * 100).toFixed(1)
                                                                        : 0}% of total
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-stone-500 uppercase tracking-widest mb-1">Labor</p>
                                                                <p className="text-stone-300 font-semibold tabular-nums">{IDR(row.labor_cost)}</p>
                                                                <p className="text-stone-600">
                                                                    {row.total_batch_cost > 0
                                                                        ? ((row.labor_cost / row.total_batch_cost) * 100).toFixed(1)
                                                                        : 0}% of total
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-stone-500 uppercase tracking-widest mb-1">Overhead</p>
                                                                <p className="text-stone-300 font-semibold tabular-nums">{IDR(row.overhead_cost)}</p>
                                                                <p className="text-stone-600">
                                                                    {row.total_batch_cost > 0
                                                                        ? ((row.overhead_cost / row.total_batch_cost) * 100).toFixed(1)
                                                                        : 0}% of total
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-stone-500 uppercase tracking-widest mb-1">Total batch</p>
                                                                <p className="text-stone-100 font-semibold tabular-nums">{IDR(row.total_batch_cost)}</p>
                                                                <p className="text-stone-600">{row.batch_yield} {row.yield_unit} produced</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                        <div className="px-5 py-3 border-t border-stone-800">
                            <p className="text-xs text-stone-600">{filtered.length} snapshot{filtered.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                )
            )}

            {confirmDelete && (
                <Modal title="Delete Snapshot" onClose={() => setConfirmDelete(null)}>
                    <p className="text-sm text-stone-300 mb-6">
                        Delete this snapshot for <span className="text-white font-semibold">{confirmDelete.recipe_name}</span> from{' '}
                        <span className="text-stone-400">{confirmDelete.calculated_at.slice(0, 10)}</span>?
                        This only removes the historical record, not the recipe itself.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800 transition-colors">
                            Cancel
                        </button>
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