import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dashboardApi } from '@/lib/api'

const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function StatCard({ label, value, to }: { label: string; value: number; to: string }) {
    return (
        <Link to={to} className="bg-stone-900 border border-stone-800 hover:border-stone-600 rounded-lg px-5 py-5 transition-colors group">
            <p className="text-xs text-stone-500 uppercase tracking-widest mb-2">{label}</p>
            <p className="text-3xl font-bold text-stone-100 tabular-nums group-hover:text-amber-400 transition-colors">
                {value.toLocaleString()}
            </p>
        </Link>
    )
}

export default function DashboardPage() {
    const { data: stats } = useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.stats })
    const { data: topIngs } = useQuery({ queryKey: ['top-ingredients'], queryFn: dashboardApi.topIngredients })
    const { data: recents } = useQuery({ queryKey: ['recent-snapshots'], queryFn: dashboardApi.recentSnapshots })

    const maxPrice = topIngs ? Math.max(...topIngs.map(i => i.price_per_unit)) : 1

    return (
        <div className="max-w-5xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-stone-100">Dashboard</h1>
                <p className="text-sm text-stone-500 mt-1">Overview of your food cost data</p>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <StatCard label="Ingredients" value={stats?.ingredient_count ?? 0} to="/ingredients" />
                <StatCard label="Recipes" value={stats?.recipe_count ?? 0} to="/recipes" />
                <StatCard label="Suppliers" value={stats?.supplier_count ?? 0} to="/suppliers" />
                <StatCard label="COGS Snapshots" value={stats?.snapshot_count ?? 0} to="/history" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* top ingredients by price */}
                <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
                        <h2 className="text-xs text-stone-500 uppercase tracking-widest">Top ingredients by price</h2>
                        <Link to="/ingredients" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">View all →</Link>
                    </div>
                    {!topIngs || topIngs.length === 0 ? (
                        <p className="px-5 py-8 text-stone-600 text-sm text-center">No ingredients yet.</p>
                    ) : (
                        <div className="flex flex-col divide-y divide-stone-800/50">
                            {topIngs.map(ing => (
                                <div key={ing.id} className="px-5 py-3 hover:bg-stone-800/30 transition-colors">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-stone-200">{ing.name}</span>
                                            <span className="text-xs bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded">{ing.unit}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-semibold text-amber-400 tabular-nums">
                                                {IDR(ing.price_per_unit)}
                                            </span>
                                            <span className="text-xs text-stone-600 ml-1">/{ing.unit}</span>
                                        </div>
                                    </div>
                                    {/* price bar */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1 bg-stone-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-400 rounded-full transition-all"
                                                style={{ width: `${(ing.price_per_unit / maxPrice) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-stone-600 shrink-0">
                                            {ing.used_in_recipes > 0
                                                ? `${ing.used_in_recipes} recipe${ing.used_in_recipes > 1 ? 's' : ''}`
                                                : 'unused'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* recent COGS snapshots */}
                <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
                        <h2 className="text-xs text-stone-500 uppercase tracking-widest">Recent COGS calculations</h2>
                        <Link to="/history" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">View all →</Link>
                    </div>
                    {!recents || recents.length === 0 ? (
                        <div className="px-5 py-8 text-center">
                            <p className="text-stone-600 text-sm">No calculations yet.</p>
                            <Link to="/cogs" className="text-xs text-amber-400 hover:text-amber-300 mt-2 inline-block transition-colors">
                                Run your first COGS →
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col divide-y divide-stone-800/50">
                            {recents.map(snap => (
                                <div key={snap.id} className="px-5 py-3 hover:bg-stone-800/30 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-stone-200 font-medium">{snap.recipe_name}</p>
                                            <p className="text-xs text-stone-600 mt-0.5">{snap.calculated_at}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-amber-400 tabular-nums">
                                                {IDR(snap.cost_per_unit)}
                                                <span className="text-xs font-normal text-stone-500"> /unit</span>
                                            </p>
                                            <p className="text-xs text-stone-500 mt-0.5">
                                                sell {IDR(snap.suggested_price)} · {(snap.margin_pct * 100).toFixed(0)}% margin
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* quick actions */}
            <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                    { label: 'Add ingredient', to: '/ingredients', hint: 'Log a new raw material' },
                    { label: 'Build a recipe', to: '/recipes', hint: 'Compose from ingredients' },
                    { label: 'Calculate COGS', to: '/cogs', hint: 'Get cost per unit + price' },
                ].map(action => (
                    <Link
                        key={action.to}
                        to={action.to}
                        className="bg-stone-900 border border-stone-800 hover:border-amber-400/40 rounded-lg px-4 py-4 transition-colors group"
                    >
                        <p className="text-sm font-medium text-stone-300 group-hover:text-amber-400 transition-colors">
                            {action.label} →
                        </p>
                        <p className="text-xs text-stone-600 mt-1">{action.hint}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}