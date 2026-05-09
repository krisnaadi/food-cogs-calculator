import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recipesApi, cogsApi } from '@/lib/api'
import type { COGSResult } from '@/lib/api'

const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

interface CompareRow {
    recipeId: string
    recipeName: string
    result: COGSResult | null
    loading: boolean
    error: string | null
}

export default function ComparisonPage() {
    const { data: recipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: recipesApi.list })
    const mainRecipes = recipes.filter(r => !r.is_sub_recipe)

    const [rows, setRows] = useState<CompareRow[]>([])
    const [batchSize, setBatchSize] = useState(1)
    const [targetMargin, setTargetMargin] = useState(65)
    const [laborCost, setLaborCost] = useState(0)
    const [overheadCost, setOverheadCost] = useState(0)
    const [selectedId, setSelectedId] = useState('')

    const addRecipe = () => {
        if (!selectedId || rows.find(r => r.recipeId === selectedId)) return
        const recipe = mainRecipes.find(r => r.id === selectedId)
        if (!recipe) return
        setRows(prev => [...prev, {
            recipeId: recipe.id, recipeName: recipe.name,
            result: null, loading: false, error: null,
        }])
        setSelectedId('')
    }

    const removeRow = (id: string) => setRows(prev => prev.filter(r => r.recipeId !== id))

    const calculateAll = async () => {
        setRows(prev => prev.map(r => ({ ...r, loading: true, error: null })))
        const updated = await Promise.all(
            rows.map(async row => {
                try {
                    const result = await cogsApi.calculate({
                        recipe_id: row.recipeId,
                        batch_size: batchSize,
                        target_margin: targetMargin / 100,
                        labor_cost: laborCost,
                        overhead_cost: overheadCost,
                        save_snapshot: false,
                    })
                    return { ...row, result, loading: false, error: null }
                } catch (e) {
                    return { ...row, result: null, loading: false, error: (e as Error).message }
                }
            })
        )
        setRows(updated)
    }

    const hasResults = rows.some(r => r.result !== null)
    const maxCost = hasResults
        ? Math.max(...rows.filter(r => r.result).map(r => r.result!.cost_per_unit))
        : 1

    return (
        <div className="max-w-6xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-stone-100">Recipe Comparison</h1>
                <p className="text-sm text-stone-500 mt-1">Compare COGS and margin across multiple recipes at once</p>
            </div>

            {/* params bar */}
            <div className="bg-stone-900 border border-stone-800 rounded-lg p-5 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                    <div className="col-span-2 md:col-span-1">
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Batch size</label>
                        <input
                            type="number" min="1" value={batchSize}
                            onChange={e => setBatchSize(+e.target.value)}
                            className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 w-full focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">
                            Margin — {targetMargin}%
                        </label>
                        <input
                            type="range" min="1" max="95" value={targetMargin}
                            onChange={e => setTargetMargin(+e.target.value)}
                            className="w-full accent-amber-400 mt-2"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Labor (IDR)</label>
                        <input
                            type="number" min="0" value={laborCost}
                            onChange={e => setLaborCost(+e.target.value)}
                            className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 w-full focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Overhead (IDR)</label>
                        <input
                            type="number" min="0" value={overheadCost}
                            onChange={e => setOverheadCost(+e.target.value)}
                            className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 w-full focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>
                    <button
                        onClick={calculateAll}
                        disabled={rows.length === 0}
                        className="bg-amber-400 text-stone-950 font-semibold text-sm py-2 px-4 rounded hover:bg-amber-300 disabled:opacity-40 transition-colors"
                    >
                        Calculate All
                    </button>
                </div>
            </div>

            {/* add recipe row */}
            <div className="flex gap-3 mb-5">
                <select
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    className="flex-1 bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-amber-400 transition-colors"
                >
                    <option value="">Add a recipe to compare…</option>
                    {mainRecipes
                        .filter(r => !rows.find(row => row.recipeId === r.id))
                        .map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                    }
                </select>
                <button
                    onClick={addRecipe}
                    disabled={!selectedId}
                    className="bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm font-medium px-4 py-2 rounded disabled:opacity-40 transition-colors"
                >
                    + Add
                </button>
            </div>

            {rows.length === 0 ? (
                <div className="border border-dashed border-stone-800 rounded-lg px-6 py-16 text-center text-stone-600 text-sm">
                    Add at least two recipes above, then hit Calculate All.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {/* result cards */}
                    {rows.map(row => (
                        <div key={row.recipeId}
                            className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
                                <h3 className="text-sm font-semibold text-stone-100">{row.recipeName}</h3>
                                <button onClick={() => removeRow(row.recipeId)}
                                    className="text-xs text-stone-600 hover:text-red-400 transition-colors">
                                    Remove
                                </button>
                            </div>

                            {row.loading && (
                                <div className="px-5 py-6 text-stone-500 text-sm">Calculating…</div>
                            )}
                            {row.error && (
                                <div className="px-5 py-4 text-red-400 text-sm">{row.error}</div>
                            )}
                            {!row.loading && !row.error && !row.result && (
                                <div className="px-5 py-6 text-stone-600 text-sm">
                                    Hit "Calculate All" to see results.
                                </div>
                            )}

                            {row.result && (
                                <div className="px-5 py-4">
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Cost / unit</p>
                                            <p className="text-xl font-bold text-amber-400 tabular-nums">
                                                {IDR(row.result.cost_per_unit)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Sell price</p>
                                            <p className="text-xl font-bold text-stone-100 tabular-nums">
                                                {IDR(row.result.suggested_price)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Profit / unit</p>
                                            <p className="text-xl font-bold text-green-400 tabular-nums">
                                                {IDR(row.result.suggested_price - row.result.cost_per_unit)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Ing. cost</p>
                                            <p className="text-base font-semibold text-stone-300 tabular-nums">
                                                {IDR(row.result.ingredient_cost)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Batch yield</p>
                                            <p className="text-base font-semibold text-stone-300">
                                                {row.result.batch_yield} units
                                            </p>
                                        </div>
                                    </div>

                                    {/* relative cost bar */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                                style={{ width: `${(row.result.cost_per_unit / maxCost) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-stone-500 shrink-0 w-16 text-right">
                                            {maxCost > 0
                                                ? `${((row.result.cost_per_unit / maxCost) * 100).toFixed(0)}% of max`
                                                : '—'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* winner summary */}
                    {hasResults && rows.filter(r => r.result).length >= 2 && (() => {
                        const withResults = rows.filter(r => r.result)
                        const bestMargin = withResults.reduce((a, b) =>
                            (b.result!.suggested_price - b.result!.cost_per_unit) >
                                (a.result!.suggested_price - a.result!.cost_per_unit) ? b : a
                        )
                        const lowestCost = withResults.reduce((a, b) =>
                            b.result!.cost_per_unit < a.result!.cost_per_unit ? b : a
                        )
                        return (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="bg-green-400/10 border border-green-400/30 rounded-lg px-4 py-3">
                                    <p className="text-xs text-green-400/70 uppercase tracking-widest mb-1">Best profit/unit</p>
                                    <p className="text-sm font-semibold text-green-400">{bestMargin.recipeName}</p>
                                    <p className="text-xs text-green-400/60 mt-0.5">
                                        {IDR(bestMargin.result!.suggested_price - bestMargin.result!.cost_per_unit)} per unit
                                    </p>
                                </div>
                                <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg px-4 py-3">
                                    <p className="text-xs text-amber-400/70 uppercase tracking-widest mb-1">Lowest COGS</p>
                                    <p className="text-sm font-semibold text-amber-400">{lowestCost.recipeName}</p>
                                    <p className="text-xs text-amber-400/60 mt-0.5">
                                        {IDR(lowestCost.result!.cost_per_unit)} per unit
                                    </p>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}
        </div>
    )
}