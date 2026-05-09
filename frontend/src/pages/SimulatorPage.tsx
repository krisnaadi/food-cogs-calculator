import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recipesApi } from '@/lib/api'

const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function unitFactor(ingredientUnit: string, lineUnit: string): number {
    if (ingredientUnit === lineUnit) return 1
    const table: Record<string, number> = {
        'kg>g': 0.001, 'kg>mg': 0.000001,
        'g>kg': 1000, 'g>mg': 0.001,
        'mg>g': 1000, 'mg>kg': 1000000,
        'l>ml': 0.001, 'ml>l': 1000,
    }
    return table[`${ingredientUnit}>${lineUnit}`] ?? 1
}

export default function SimulatorPage() {
    const { data: recipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: recipesApi.list })
    const mainRecipes = recipes.filter(r => !r.is_sub_recipe)

    const [selectedId, setSelectedId] = useState('')
    const [batchSize, setBatchSize] = useState(1)
    const [targetMargin, setTargetMargin] = useState(65)
    const [laborCost, setLaborCost] = useState(0)
    const [overheadCost, setOverheadCost] = useState(0)
    // price overrides: ingredientId → adjusted price
    const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({})

    const selectedRecipe = mainRecipes.find(r => r.id === selectedId)

    // gather unique ingredients from recipe lines
    const ingredientLines = useMemo(() => {
        if (!selectedRecipe) return []
        return selectedRecipe.lines.filter(l => l.ingredient_id !== null)
    }, [selectedRecipe])

    // when recipe changes, reset overrides to current prices
    const handleRecipeChange = (id: string) => {
        setSelectedId(id)
        setPriceOverrides({})
    }

    const getPrice = (line: typeof ingredientLines[0]) =>
        priceOverrides[line.ingredient_id!] ?? line.price_per_unit

    // baseline COGS (original prices)
    const baselineCost = useMemo(() => {
        if (!selectedRecipe) return 0
        return ingredientLines.reduce((sum, line) => {
            const factor = unitFactor(line.ingredient_unit ?? line.unit, line.unit)
            const price = line.price_per_unit * factor
            const raw = line.quantity * price
            const adj = line.waste_pct > 0 ? raw / (1 - line.waste_pct) : raw
            return sum + adj
        }, 0) * batchSize
    }, [selectedRecipe, ingredientLines, batchSize])

    // simulated COGS (adjusted prices)
    const simCost = useMemo(() => {
        if (!selectedRecipe) return 0
        return ingredientLines.reduce((sum, line) => {
            const factor = unitFactor(line.ingredient_unit ?? line.unit, line.unit)
            const price = getPrice(line) * factor
            const raw = line.quantity * price
            const adj = line.waste_pct > 0 ? raw / (1 - line.waste_pct) : raw
            return sum + adj
        }, 0) * batchSize
    }, [selectedRecipe, ingredientLines, batchSize, priceOverrides])

    const batchYield = selectedRecipe ? selectedRecipe.batch_yield * batchSize : 1

    const baseTotalCost = baselineCost + laborCost + overheadCost
    const simTotalCost = simCost + laborCost + overheadCost

    const baseCPU = baseTotalCost / batchYield
    const simCPU = simTotalCost / batchYield

    const basePrice = baseCPU / (1 - targetMargin / 100)
    const simPrice = simCPU / (1 - targetMargin / 100)

    const delta = simCPU - baseCPU
    const deltaPrice = simPrice - basePrice
    const deltaPct = baseCPU > 0 ? (delta / baseCPU) * 100 : 0

    const hasOverrides = Object.keys(priceOverrides).length > 0

    return (
        <div className="max-w-5xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-stone-100">What-If Simulator</h1>
                <p className="text-sm text-stone-500 mt-1">
                    Adjust ingredient prices and see the real-time impact on COGS
                </p>
            </div>

            {/* controls */}
            <div className="bg-stone-900 border border-stone-800 rounded-lg p-5 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2 md:col-span-1">
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Recipe</label>
                        <select
                            value={selectedId}
                            onChange={e => handleRecipeChange(e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-amber-400 transition-colors"
                        >
                            <option value="">Select recipe…</option>
                            {mainRecipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Batch size</label>
                        <input type="number" min="1" value={batchSize}
                            onChange={e => setBatchSize(+e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Labor (IDR)</label>
                        <input type="number" min="0" value={laborCost}
                            onChange={e => setLaborCost(+e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-stone-500 uppercase tracking-widest block mb-1">Overhead (IDR)</label>
                        <input type="number" min="0" value={overheadCost}
                            onChange={e => setOverheadCost(+e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <label className="text-xs text-stone-500 uppercase tracking-widest">
                        Target margin — {targetMargin}%
                    </label>
                    <input type="range" min="1" max="95" value={targetMargin}
                        onChange={e => setTargetMargin(+e.target.value)}
                        className="flex-1 accent-amber-400"
                    />
                </div>
            </div>

            {!selectedRecipe ? (
                <div className="border border-dashed border-stone-800 rounded-lg px-6 py-16 text-center text-stone-600 text-sm">
                    Select a recipe to start simulating price changes
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

                    {/* ingredient sliders */}
                    <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
                            <h2 className="text-xs text-stone-500 uppercase tracking-widest">
                                Adjust ingredient prices
                            </h2>
                            {hasOverrides && (
                                <button
                                    onClick={() => setPriceOverrides({})}
                                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                                >
                                    Reset all
                                </button>
                            )}
                        </div>
                        <div className="divide-y divide-stone-800/50">
                            {ingredientLines.map(line => {
                                const original = line.price_per_unit
                                const current = getPrice(line)
                                const changed = Math.abs(current - original) > 0.001
                                const pctChange = original > 0 ? ((current - original) / original) * 100 : 0

                                const factor = unitFactor(line.ingredient_unit ?? line.unit, line.unit)
                                const effectiveOrig = original * factor
                                const effectiveCurr = current * factor
                                const baseLineAdj = (() => {
                                    const raw = line.quantity * effectiveOrig
                                    return line.waste_pct > 0 ? raw / (1 - line.waste_pct) : raw
                                })() * batchSize
                                const simLineAdj = (() => {
                                    const raw = line.quantity * effectiveCurr
                                    return line.waste_pct > 0 ? raw / (1 - line.waste_pct) : raw
                                })() * batchSize

                                return (
                                    <div key={line.id} className={`px-5 py-4 ${changed ? 'bg-amber-400/5' : ''}`}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-sm text-stone-200 font-medium">{line.ingredient_name}</p>
                                                <p className="text-xs text-stone-500 mt-0.5">
                                                    {line.quantity} {line.unit} ·{' '}
                                                    {line.ingredient_unit !== line.unit
                                                        ? `priced per ${line.ingredient_unit}`
                                                        : `per ${line.unit}`}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-semibold tabular-nums ${changed ? 'text-amber-400' : 'text-stone-300'}`}>
                                                    {IDR(current)}
                                                    <span className="text-xs text-stone-500 font-normal">/{line.ingredient_unit ?? line.unit}</span>
                                                </p>
                                                {changed && (
                                                    <p className={`text-xs mt-0.5 ${pctChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                        {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}% from {IDR(original)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* price input + slider */}
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min={Math.max(0, original * 0.3)}
                                                max={original * 2.5}
                                                step={original * 0.01}
                                                value={current}
                                                onChange={e => setPriceOverrides(prev => ({
                                                    ...prev, [line.ingredient_id!]: +e.target.value,
                                                }))}
                                                className="flex-1 accent-amber-400"
                                            />
                                            <input
                                                type="number"
                                                value={current}
                                                min={0}
                                                step="100"
                                                onChange={e => setPriceOverrides(prev => ({
                                                    ...prev, [line.ingredient_id!]: +e.target.value,
                                                }))}
                                                className="w-28 bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-400 transition-colors tabular-nums"
                                            />
                                            {changed && (
                                                <button
                                                    onClick={() => setPriceOverrides(prev => {
                                                        const next = { ...prev }
                                                        delete next[line.ingredient_id!]
                                                        return next
                                                    })}
                                                    className="text-xs text-stone-600 hover:text-stone-300 transition-colors shrink-0"
                                                    title="Reset to original"
                                                >
                                                    ↺
                                                </button>
                                            )}
                                        </div>

                                        {/* line cost delta */}
                                        <div className="flex justify-between mt-2 text-xs text-stone-500">
                                            <span>Line cost: {IDR(baseLineAdj)}</span>
                                            {changed && (
                                                <span className={simLineAdj > baseLineAdj ? 'text-red-400' : 'text-green-400'}>
                                                    → {IDR(simLineAdj)}
                                                    {' '}({simLineAdj > baseLineAdj ? '+' : ''}{IDR(simLineAdj - baseLineAdj)})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* results panel */}
                    <div className="flex flex-col gap-4 lg:sticky lg:top-6">
                        {/* impact */}
                        <div className={`rounded-lg px-5 py-4 border ${!hasOverrides ? 'bg-stone-900 border-stone-800'
                            : delta > 0 ? 'bg-red-400/10 border-red-400/30'
                                : 'bg-green-400/10 border-green-400/30'
                            }`}>
                            <p className={`text-xs uppercase tracking-widest mb-2 ${!hasOverrides ? 'text-stone-500'
                                : delta > 0 ? 'text-red-400/70'
                                    : 'text-green-400/70'
                                }`}>
                                Cost impact
                            </p>
                            {!hasOverrides ? (
                                <p className="text-stone-500 text-sm">Adjust a price to see impact</p>
                            ) : (
                                <>
                                    <div className="mb-3">
                                        <p className="text-xs text-stone-500 mb-0.5">Cost / unit</p>
                                        <p className={`text-2xl font-bold tabular-nums ${delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            {delta > 0 ? '+' : ''}{IDR(delta)}
                                        </p>
                                        <p className={`text-xs mt-0.5 ${delta > 0 ? 'text-red-400/60' : 'text-green-400/60'}`}>
                                            {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}% change in COGS
                                        </p>
                                    </div>

                                    <div className={`border-t pt-3 ${delta > 0 ? 'border-red-400/20' : 'border-green-400/20'}`}>
                                        <p className="text-xs text-stone-500 mb-0.5">Suggested sell price</p>
                                        <p className={`text-xl font-bold tabular-nums ${deltaPrice > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            {deltaPrice > 0 ? '+' : ''}{IDR(deltaPrice)}
                                        </p>
                                        <p className={`text-xs mt-0.5 ${deltaPrice > 0 ? 'text-red-400/60' : 'text-green-400/60'}`}>
                                            {deltaPrice > 0
                                                ? `Raise your price by ${IDR(deltaPrice)} to maintain ${targetMargin}% margin`
                                                : `You could lower your price by ${IDR(Math.abs(deltaPrice))} and keep the same margin`}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* before / after */}
                        <div className="bg-stone-900 border border-stone-800 rounded-lg p-4">
                            <h3 className="text-xs text-stone-500 uppercase tracking-widest mb-4">Before vs After</h3>
                            <div className="flex flex-col gap-3 text-sm">
                                {[
                                    { label: 'Cost / unit', base: baseCPU, sim: simCPU },
                                    { label: 'Sell price', base: basePrice, sim: simPrice },
                                    { label: 'Profit / unit', base: basePrice - baseCPU, sim: simPrice - simCPU },
                                ].map(({ label, base, sim }) => {
                                    const diff = sim - base
                                    const changed = Math.abs(diff) > 0.01
                                    return (
                                        <div key={label} className="flex items-center justify-between">
                                            <span className="text-stone-500 text-xs uppercase tracking-widest">{label}</span>
                                            <div className="text-right">
                                                <span className="text-stone-400 tabular-nums text-xs line-through mr-2">
                                                    {IDR(base)}
                                                </span>
                                                <span className={`font-semibold tabular-nums ${!changed ? 'text-stone-300'
                                                    : label === 'Profit / unit'
                                                        ? diff > 0 ? 'text-green-400' : 'text-red-400'
                                                        : diff > 0 ? 'text-red-400' : 'text-green-400'
                                                    }`}>
                                                    {IDR(sim)}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* margin guide */}
                        <div className="bg-stone-900 border border-stone-800 rounded-lg p-4">
                            <h3 className="text-xs text-stone-500 uppercase tracking-widest mb-3">Price at different margins</h3>
                            <div className="flex flex-col gap-2">
                                {[60, 65, 70, 75].map(m => {
                                    const price = simCPU / (1 - m / 100)
                                    return (
                                        <div key={m} className={`flex justify-between text-xs ${m === targetMargin ? 'text-amber-400 font-semibold' : 'text-stone-400'}`}>
                                            <span>{m}% margin</span>
                                            <span className="tabular-nums">{IDR(price)}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}