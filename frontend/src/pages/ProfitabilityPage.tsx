import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recipesApi, cogsApi } from '@/lib/api'
import type { COGSResult } from '@/lib/api'
import { exportCSV } from '@/lib/csv'

const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

type SortKey = 'profit' | 'margin' | 'cost' | 'price'

interface RankedRecipe {
    recipeId: string
    recipeName: string
    category: string | null
    result: COGSResult
}

export default function ProfitabilityPage() {
    const { data: recipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: recipesApi.list })
    const mainRecipes = recipes.filter(r => !r.is_sub_recipe)

    const [targetMargin, setTargetMargin] = useState(65)
    const [laborCost, setLaborCost] = useState(0)
    const [overheadCost, setOverheadCost] = useState(0)
    const [sortKey, setSortKey] = useState<SortKey>('profit')
    const [sortAsc, setSortAsc] = useState(false)
    const [ranked, setRanked] = useState<RankedRecipe[]>([])
    const [loading, setLoading] = useState(false)

    const handleCalculateAll = async () => {
        setLoading(true)
        const results = await Promise.all(
            mainRecipes.map(async r => {
                try {
                    const result = await cogsApi.calculate({
                        recipe_id: r.id,
                        batch_size: 1,
                        target_margin: targetMargin / 100,
                        labor_cost: laborCost,
                        overhead_cost: overheadCost,
                        save_snapshot: false,
                    })
                    return { recipeId: r.id, recipeName: r.name, category: r.category, result }
                } catch {
                    return null
                }
            })
        )
        setRanked(results.filter(Boolean) as RankedRecipe[])
        setLoading(false)
    }

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(v => !v)
        else { setSortKey(key); setSortAsc(false) }
    }

    const sorted = [...ranked].sort((a, b) => {
        const profitA = a.result.suggested_price - a.result.cost_per_unit
        const profitB = b.result.suggested_price - b.result.cost_per_unit
        const vals: Record<SortKey, [number, number]> = {
            profit: [profitA, profitB],
            margin: [a.result.margin_pct, b.result.margin_pct],
            cost: [a.result.cost_per_unit, b.result.cost_per_unit],
            price: [a.result.suggested_price, b.result.suggested_price],
        }
        const [va, vb] = vals[sortKey]
        return sortAsc ? va - vb : vb - va
    })

    const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
        <th
            onClick={() => toggleSort(k)}
            className="text-right px-4 py-3 font-medium cursor-pointer hover:text-amber-400 transition-colors select-none"
        >
            {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
        </th>
    )

    const maxProfit = sorted.length > 0
        ? Math.max(...sorted.map(r => r.result.suggested_price - r.result.cost_per_unit))
        : 1

    return (
        <div className="max-w-5xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-stone-100">Profitability Ranking</h1>
                <p className="text-sm text-stone-500 mt-1">Rank all recipes by profit and margin at shared cost assumptions</p>
            </div>

            {/* params */}
            <div className="bg-stone-900 border border-stone-800 rounded-lg p-5 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">
                            Margin — {targetMargin}%
                        </label>
                        <input type="range" min="1" max="95" value={targetMargin}
                            onChange={e => setTargetMargin(+e.target.value)}
                            className="w-full accent-amber-400 mt-2" />
                    </div>
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Shared labor (IDR)</label>
                        <input type="number" min="0" value={laborCost}
                            onChange={e => setLaborCost(+e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors" />
                    </div>
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Shared overhead (IDR)</label>
                        <input type="number" min="0" value={overheadCost}
                            onChange={e => setOverheadCost(+e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors" />
                    </div>
                    <button
                        onClick={handleCalculateAll}
                        disabled={loading || mainRecipes.length === 0}
                        className="bg-amber-400 text-stone-950 font-semibold text-sm py-2 px-4 rounded hover:bg-amber-300 disabled:opacity-40 transition-colors"
                    >
                        {loading ? 'Calculating…' : `Rank ${mainRecipes.length} recipes`}
                    </button>
                </div>
            </div>

            {sorted.length === 0 && !loading && (
                <div className="border border-dashed border-stone-800 rounded-lg px-6 py-16 text-center text-stone-600 text-sm">
                    Set your cost assumptions above and hit Rank to see all recipes ranked by profitability.
                </div>
            )}

            {sorted.length > 0 && (
                <div className="flex justify-end mb-3">
                    <button
                        onClick={() => exportCSV(
                            'profitability.csv',
                            ['Rank', 'Recipe', 'Category', 'Cost/Unit', 'Sell Price', 'Profit/Unit', 'Margin %'],
                            sorted.map((r, i) => [
                                i + 1, r.recipeName, r.category,
                                r.result.cost_per_unit, r.result.suggested_price,
                                (r.result.suggested_price - r.result.cost_per_unit).toFixed(2),
                                (r.result.margin_pct * 100).toFixed(0),
                            ])
                        )}
                        className="text-xs text-stone-400 hover:text-stone-200 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded transition-colors"
                    >
                        ↓ Export CSV
                    </button>
                </div>
            )}

            {sorted.length > 0 && (
                <>
                    {/* top 3 podium */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                        {sorted.slice(0, 3).map((r, i) => {
                            const profit = r.result.suggested_price - r.result.cost_per_unit
                            const colors = ['text-amber-400', 'text-stone-300', 'text-amber-700']
                            const borders = ['border-amber-400/40', 'border-stone-600', 'border-amber-700/40']
                            return (
                                <div key={r.recipeId} className={`bg-stone-900 border ${borders[i]} rounded-lg px-4 py-4 text-center`}>
                                    <p className={`text-lg font-bold ${colors[i]}`}>#{i + 1}</p>
                                    <p className="text-sm text-stone-100 font-medium mt-1 truncate">{r.recipeName}</p>
                                    {r.category && <p className="text-xs text-stone-500 mt-0.5">{r.category}</p>}
                                    <p className="text-lg font-bold text-green-400 tabular-nums mt-2">{IDR(profit)}</p>
                                    <p className="text-xs text-stone-500">profit / unit</p>
                                </div>
                            )
                        })}
                    </div>

                    {/* full table */}
                    <div className="border border-stone-800 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-stone-800 text-xs text-stone-500 uppercase tracking-widest">
                                    <th className="text-left px-4 py-3 font-medium w-8">#</th>
                                    <th className="text-left px-4 py-3 font-medium">Recipe</th>
                                    <SortHeader label="Cost/unit" k="cost" />
                                    <SortHeader label="Sell price" k="price" />
                                    <SortHeader label="Profit/unit" k="profit" />
                                    <SortHeader label="Margin" k="margin" />
                                    <th className="px-4 py-3 font-medium">Profit bar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((r, i) => {
                                    const profit = r.result.suggested_price - r.result.cost_per_unit
                                    const barPct = maxProfit > 0 ? (profit / maxProfit) * 100 : 0
                                    const isTop = i === 0
                                    return (
                                        <tr key={r.recipeId}
                                            className={`border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors ${isTop ? 'bg-amber-400/5' : i % 2 === 0 ? '' : 'bg-stone-900/30'}`}>
                                            <td className="px-4 py-3">
                                                <span className={`text-sm font-bold ${isTop ? 'text-amber-400' : 'text-stone-600'}`}>
                                                    {i + 1}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-stone-100 font-medium">{r.recipeName}</p>
                                                {r.category && <p className="text-xs text-stone-500">{r.category}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-stone-400">
                                                {IDR(r.result.cost_per_unit)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-stone-300">
                                                {IDR(r.result.suggested_price)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-green-400 font-semibold">
                                                {IDR(profit)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-amber-400">
                                                {(r.result.margin_pct * 100).toFixed(0)}%
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="w-28 h-2 bg-stone-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-400 rounded-full transition-all duration-500"
                                                        style={{ width: `${barPct}%` }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    )
}