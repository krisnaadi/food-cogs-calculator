import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api'

const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

type SortKey = 'recipe_count' | 'price_per_unit' | 'name'

export default function UsageReportPage() {
    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['ingredient-usage'],
        queryFn: dashboardApi.ingredientUsage,
    })

    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState<SortKey>('recipe_count')
    const [sortAsc, setSortAsc] = useState(false)
    const [showUnused, setShowUnused] = useState(true)

    const toggleSort = (k: SortKey) => {
        if (sortKey === k) setSortAsc(v => !v)
        else { setSortKey(k); setSortAsc(false) }
    }

    const filtered = rows
        .filter(r => showUnused || Number(r.recipe_count) > 0)
        .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const vals: Record<SortKey, [unknown, unknown]> = {
                recipe_count: [Number(a.recipe_count), Number(b.recipe_count)],
                price_per_unit: [a.price_per_unit, b.price_per_unit],
                name: [a.name, b.name],
            }
            const [va, vb] = vals[sortKey]
            const result = typeof va === 'string'
                ? (va as string).localeCompare(vb as string)
                : (va as number) - (vb as number)
            return sortAsc ? result : -result
        })

    const unusedCount = rows.filter(r => Number(r.recipe_count) === 0).length
    const maxRecipes = rows.length > 0 ? Math.max(...rows.map(r => Number(r.recipe_count))) : 1

    const SortHeader = ({ label, k, right = true }: { label: string; k: SortKey; right?: boolean }) => (
        <th
            onClick={() => toggleSort(k)}
            className={`${right ? 'text-right' : 'text-left'} px-4 py-3 font-medium cursor-pointer hover:text-amber-400 transition-colors select-none`}
        >
            {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
        </th>
    )

    return (
        <div className="max-w-5xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-stone-100">Ingredient Usage Report</h1>
                <p className="text-sm text-stone-500 mt-1">
                    Which ingredients are used across your recipes
                </p>
            </div>

            {/* filters */}
            <div className="flex items-center gap-3 mb-5">
                <input
                    type="search"
                    placeholder="Search ingredients…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-amber-400 transition-colors"
                />
                <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={showUnused}
                        onChange={e => setShowUnused(e.target.checked)}
                        className="accent-amber-400"
                    />
                    Show unused
                </label>
                {unusedCount > 0 && (
                    <span className="text-xs text-stone-600 shrink-0">
                        {unusedCount} unused ingredient{unusedCount !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {isLoading && <p className="text-stone-500 text-sm">Loading…</p>}

            {!isLoading && (
                <div className="border border-stone-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-stone-800 text-xs text-stone-500 uppercase tracking-widest">
                                <SortHeader label="Ingredient" k="name" right={false} />
                                <th className="text-left px-4 py-3 font-medium">Unit</th>
                                <SortHeader label="Price/unit" k="price_per_unit" />
                                <SortHeader label="Used in" k="recipe_count" />
                                <th className="text-left px-4 py-3 font-medium">Recipes</th>
                                <th className="px-4 py-3 font-medium">Usage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row, i) => {
                                const count = Number(row.recipe_count)
                                const barPct = maxRecipes > 0 ? (count / maxRecipes) * 100 : 0
                                const unused = count === 0
                                return (
                                    <tr key={row.id}
                                        className={`border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors ${unused ? 'opacity-50' : ''} ${i % 2 === 0 ? '' : 'bg-stone-900/30'}`}>
                                        <td className="px-4 py-3">
                                            <p className="text-stone-100 font-medium">{row.name}</p>
                                            <p className="text-xs text-stone-500">
                                                {(Number(row.waste_pct) * 100).toFixed(1)}% waste
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-stone-800 text-stone-400 text-xs px-2 py-0.5 rounded">{row.unit}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-amber-400 font-medium">
                                            {IDR(row.price_per_unit)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            <span className={count > 0 ? 'text-stone-300 font-semibold' : 'text-stone-600'}>
                                                {count} {count === 1 ? 'recipe' : 'recipes'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-stone-500 max-w-[200px] truncate">
                                            {row.used_in_recipes || <span className="text-stone-700 italic">Not used</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-20 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-amber-400 rounded-full"
                                                    style={{ width: `${barPct}%` }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    <div className="px-4 py-3 border-t border-stone-800">
                        <p className="text-xs text-stone-600">{filtered.length} ingredient{filtered.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            )}
        </div>
    )
}