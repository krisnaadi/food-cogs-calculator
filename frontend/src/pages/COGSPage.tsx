import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    PieChart, Pie, Cell, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cogsApi, overheadApi, recipesApi } from '@/lib/api'
import type { COGSResult, OverheadTemplate } from '@/lib/api'
import Modal from '@/components/Modal'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const inputCls = 'bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors w-full'
const selectCls = inputCls

function Field({ label, hint, error, children }: {
    label: string; hint?: string; error?: string; children: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-stone-400 uppercase tracking-widest">{label}</label>
            {hint && <p className="text-xs text-stone-600 -mt-0.5">{hint}</p>}
            {children}
            {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
    )
}

// ---------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------
function StatCard({ label, value, sub, accent = false }: {
    label: string; value: string; sub?: string; accent?: boolean
}) {
    return (
        <div className={`rounded-lg px-5 py-4 border ${accent
            ? 'bg-amber-400/10 border-amber-400/30'
            : 'bg-stone-900 border-stone-800'
            }`}>
            <p className={`text-xs uppercase tracking-widest mb-1 ${accent ? 'text-amber-400/70' : 'text-stone-500'}`}>
                {label}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-amber-400' : 'text-stone-100'}`}>
                {value}
            </p>
            {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-amber-400/60' : 'text-stone-500'}`}>{sub}</p>}
        </div>
    )
}

// ---------------------------------------------------------------
// Pie chart colors
// ---------------------------------------------------------------
const PIE_COLORS = [
    '#fbbf24', '#f59e0b', '#d97706', '#b45309',
    '#92400e', '#78350f', '#a3a3a3', '#737373',
]

// ---------------------------------------------------------------
// Overhead Modal
// ---------------------------------------------------------------
const overheadSchema = z.object({
    name: z.string().min(1, 'Required'),
    packaging_cost: z.number().min(0),
    utilities_cost: z.number().min(0),
    other_fixed: z.number().min(0),
})
type OverheadForm = z.infer<typeof overheadSchema>

function OverheadModal({ onClose, onCreated }: {
    onClose: () => void
    onCreated: (t: OverheadTemplate) => void
}) {
    const { register, handleSubmit, formState: { errors } } = useForm<OverheadForm>({
        resolver: zodResolver(overheadSchema),
        defaultValues: { packaging_cost: 0, utilities_cost: 0, other_fixed: 0 },
    })
    const mut = useMutation({
        mutationFn: overheadApi.create,
        onSuccess: (t) => { onCreated(t); onClose() },
    })

    return (
        <Modal title="New Overhead Template" onClose={onClose}>
            <form onSubmit={handleSubmit(v => mut.mutate(v))} className="flex flex-col gap-4">
                <Field label="Template name" error={errors.name?.message}>
                    <input {...register('name')} className={inputCls} placeholder="e.g. Standard Bakery" />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Packaging (IDR)" error={errors.packaging_cost?.message}>
                        <input {...register('packaging_cost', { valueAsNumber: true })} type="number" className={inputCls} />
                    </Field>
                    <Field label="Utilities (IDR)" error={errors.utilities_cost?.message}>
                        <input {...register('utilities_cost', { valueAsNumber: true })} type="number" className={inputCls} />
                    </Field>
                    <Field label="Other fixed (IDR)" error={errors.other_fixed?.message}>
                        <input {...register('other_fixed', { valueAsNumber: true })} type="number" className={inputCls} />
                    </Field>
                </div>
                <button
                    type="submit"
                    disabled={mut.isPending}
                    className="bg-amber-400 text-stone-950 font-semibold text-sm py-2 rounded hover:bg-amber-300 disabled:opacity-50 transition-colors"
                >
                    {mut.isPending ? 'Saving…' : 'Create Template'}
                </button>
            </form>
        </Modal>
    )
}

// ---------------------------------------------------------------
// Calculator form schema
// ---------------------------------------------------------------
const calcSchema = z.object({
    recipe_id: z.string().min(1, 'Select a recipe'),
    batch_size: z.number().min(1),
    target_margin: z.number().min(1).max(99),
    labor_cost: z.number().min(0),
    overhead_id: z.string().optional(),
    save_snapshot: z.boolean(),
})
type CalcForm = z.infer<typeof calcSchema>

// ---------------------------------------------------------------
// Results panel
// ---------------------------------------------------------------
function ResultsPanel({ result }: { result: COGSResult }) {
    const pieData = result.breakdown_by_line.map(l => ({
        name: l.ingredient_name,
        value: l.adjusted_cost,
        pct: l.percentage,
    }))

    const barData = [
        { name: 'Ingredients', value: result.ingredient_cost },
        { name: 'Labor', value: result.labor_cost },
        { name: 'Overhead', value: result.overhead_cost },
    ]

    const actualMargin = result.suggested_price > 0
        ? ((result.suggested_price - result.cost_per_unit) / result.suggested_price) * 100
        : 0

    return (
        <div className="flex flex-col gap-6">
            {/* recipe + batch info */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-stone-100">{result.recipe_name}</h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                        {result.batch_size}× batch · {result.batch_yield} units total
                    </p>
                </div>
                <span className="text-xs bg-amber-400/20 text-amber-400 px-3 py-1 rounded-full">
                    {(result.margin_pct * 100).toFixed(0)}% target margin
                </span>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Cost / unit" value={IDR(result.cost_per_unit)} accent />
                <StatCard label="Suggested price" value={IDR(result.suggested_price)} accent />
                <StatCard label="Total batch cost" value={IDR(result.total_batch_cost)} />
                <StatCard
                    label="Actual margin"
                    value={`${actualMargin.toFixed(1)}%`}
                    sub={`on ${IDR(result.suggested_price)}`}
                />
            </div>

            {/* cost split bar */}
            <div className="bg-stone-900 border border-stone-800 rounded-lg p-5">
                <h3 className="text-xs text-stone-500 uppercase tracking-widest mb-4">Cost breakdown</h3>
                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div>
                        <p className="text-xs text-stone-500">Ingredients</p>
                        <p className="text-base font-semibold text-amber-400 tabular-nums">{IDR(result.ingredient_cost)}</p>
                        <p className="text-xs text-stone-600">
                            {result.total_batch_cost > 0
                                ? ((result.ingredient_cost / result.total_batch_cost) * 100).toFixed(1)
                                : 0}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-stone-500">Labor</p>
                        <p className="text-base font-semibold text-stone-300 tabular-nums">{IDR(result.labor_cost)}</p>
                        <p className="text-xs text-stone-600">
                            {result.total_batch_cost > 0
                                ? ((result.labor_cost / result.total_batch_cost) * 100).toFixed(1)
                                : 0}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-stone-500">Overhead</p>
                        <p className="text-base font-semibold text-stone-300 tabular-nums">{IDR(result.overhead_cost)}</p>
                        <p className="text-xs text-stone-600">
                            {result.total_batch_cost > 0
                                ? ((result.overhead_cost / result.total_batch_cost) * 100).toFixed(1)
                                : 0}%
                        </p>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#292524" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#78716c', fontSize: 10 }}
                            tickFormatter={v => IDR(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#a8a29e', fontSize: 11 }} width={80} />
                        <Tooltip
                            formatter={(v: number) => IDR(v)}
                            contentStyle={{ background: '#1c1917', border: '1px solid #292524', borderRadius: 6, fontSize: 12 }}
                            labelStyle={{ color: '#d6d3d1' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {barData.map((_, i) => (
                                <Cell key={i} fill={i === 0 ? '#fbbf24' : '#57534e'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ingredient pie + table */}
            {result.breakdown_by_line.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* pie */}
                    <div className="bg-stone-900 border border-stone-800 rounded-lg p-5">
                        <h3 className="text-xs text-stone-500 uppercase tracking-widest mb-4">
                            Ingredient contribution
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(v: number, _: string, props: { payload?: { pct?: number } }) =>
                                        [`${IDR(v)} (${props.payload?.pct ?? 0}%)`, 'Cost']
                                    }
                                    contentStyle={{ background: '#1c1917', border: '1px solid #292524', borderRadius: 6, fontSize: 12 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ingredient table */}
                    <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
                        <div className="px-5 py-3 border-b border-stone-800">
                            <h3 className="text-xs text-stone-500 uppercase tracking-widest">Line breakdown</h3>
                        </div>
                        <div className="overflow-y-auto max-h-64">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-stone-600 uppercase tracking-widest border-b border-stone-800">
                                        <th className="text-left px-4 py-2 font-medium">Ingredient</th>
                                        <th className="text-right px-4 py-2 font-medium">Cost</th>
                                        <th className="text-right px-4 py-2 font-medium">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.breakdown_by_line
                                        .slice()
                                        .sort((a, b) => b.adjusted_cost - a.adjusted_cost)
                                        .map((line, i) => (
                                            <tr key={line.ingredient_id} className="border-b border-stone-800/40 hover:bg-stone-800/20">
                                                <td className="px-4 py-2 flex items-center gap-2">
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                                                    />
                                                    <span className="text-stone-300 truncate">{line.ingredient_name}</span>
                                                </td>
                                                <td className="px-4 py-2 text-right tabular-nums text-amber-400">
                                                    {IDR(line.adjusted_cost)}
                                                </td>
                                                <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                                                    {line.percentage.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* pricing guide */}
            <div className="bg-stone-900 border border-stone-800 rounded-lg p-5">
                <h3 className="text-xs text-stone-500 uppercase tracking-widest mb-4">Pricing guide</h3>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: '60% margin', margin: 0.60 },
                        { label: '65% margin', margin: 0.65 },
                        { label: '70% margin', margin: 0.70 },
                    ].map(({ label, margin }) => {
                        const price = result.cost_per_unit / (1 - margin)
                        const isTarget = Math.abs(margin - result.margin_pct) < 0.01
                        return (
                            <div
                                key={label}
                                className={`rounded-lg px-4 py-3 text-center border ${isTarget
                                    ? 'border-amber-400/40 bg-amber-400/10'
                                    : 'border-stone-700 bg-stone-800/50'
                                    }`}
                            >
                                <p className={`text-xs uppercase tracking-widest mb-1 ${isTarget ? 'text-amber-400/70' : 'text-stone-500'}`}>
                                    {label}
                                </p>
                                <p className={`text-lg font-bold tabular-nums ${isTarget ? 'text-amber-400' : 'text-stone-300'}`}>
                                    {IDR(price)}
                                </p>
                                <p className="text-xs text-stone-600 mt-0.5">per unit</p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------
export default function COGSPage() {
    const qc = useQueryClient()

    const { data: recipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: recipesApi.list })
    const { data: overheads = [], refetch: refetchOverheads } = useQuery({
        queryKey: ['overheads'], queryFn: overheadApi.list,
    })

    const [result, setResult] = useState<COGSResult | null>(null)
    const [showOverheadModal, setShowOverhead] = useState(false)

    const calcMut = useMutation({
        mutationFn: cogsApi.calculate,
        onSuccess: (result) => {
            setResult(result)
            // refresh history list and dashboard recent snapshots
            qc.invalidateQueries({ queryKey: ['cogs-history'] })
            qc.invalidateQueries({ queryKey: ['recent-snapshots'] })
            qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
        },
    })

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CalcForm>({
        resolver: zodResolver(calcSchema),
        defaultValues: {
            batch_size: 1,
            target_margin: 65,
            labor_cost: 0,
            save_snapshot: true,
        },
    })

    const watchedOverheadID = watch('overhead_id')
    const selectedOverhead = overheads.find(o => o.id === watchedOverheadID)
    const overheadTotal = selectedOverhead
        ? selectedOverhead.packaging_cost + selectedOverhead.utilities_cost + selectedOverhead.other_fixed
        : 0

    const mainRecipes = recipes.filter(r => !r.is_sub_recipe)

    const onSubmit = (values: CalcForm) => {
        calcMut.mutate({
            recipe_id: values.recipe_id,
            batch_size: values.batch_size,
            target_margin: values.target_margin / 100,
            labor_cost: values.labor_cost,
            overhead_cost: overheadTotal,
            overhead_id: values.overhead_id || undefined,
            save_snapshot: values.save_snapshot,
        })
    }

    return (
        <div className="max-w-6xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-stone-100">COGS Calculator</h1>
                <p className="text-sm text-stone-500 mt-1">Calculate cost of goods sold and suggested retail price</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

                {/* ---- left: form ---- */}
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="bg-stone-900 border border-stone-800 rounded-lg p-5 flex flex-col gap-5 sticky top-6"
                >
                    <h2 className="text-xs text-stone-500 uppercase tracking-widest">Parameters</h2>

                    <Field label="Recipe" error={errors.recipe_id?.message}>
                        <select {...register('recipe_id')} className={selectCls}>
                            <option value="">Select a recipe…</option>
                            {mainRecipes.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.name}{r.category ? ` · ${r.category}` : ''}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Batch size" hint="How many batches to calculate">
                        <input
                            {...register('batch_size', { valueAsNumber: true })}
                            type="number" min="1"
                            className={inputCls}
                        />
                    </Field>

                    <Field
                        label="Target margin %"
                        hint="Food cost method: price = COGS ÷ (1 − margin)"
                        error={errors.target_margin?.message}
                    >
                        <div className="flex items-center gap-3">
                            <input
                                {...register('target_margin', { valueAsNumber: true })}
                                type="range" min="1" max="95" step="1"
                                className="flex-1 accent-amber-400"
                            />
                            <span className="text-sm font-semibold text-amber-400 tabular-nums w-10 text-right">
                                {watch('target_margin')}%
                            </span>
                        </div>
                    </Field>

                    <Field label="Labor cost (IDR / batch)" hint="Total wages for this production run">
                        <input
                            {...register('labor_cost', { valueAsNumber: true })}
                            type="number" min="0"
                            className={inputCls}
                        />
                    </Field>

                    {/* overhead */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-stone-400 uppercase tracking-widest">Overhead template</span>
                            <button
                                type="button"
                                onClick={() => setShowOverhead(true)}
                                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                            >
                                + New template
                            </button>
                        </div>
                        <select
                            {...register('overhead_id')}
                            className={selectCls}
                        >
                            <option value="">No overhead</option>
                            {overheads.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.name} — {IDR(o.packaging_cost + o.utilities_cost + o.other_fixed)}
                                </option>
                            ))}
                        </select>
                        {selectedOverhead && (
                            <div className="mt-2 text-xs text-stone-500 grid grid-cols-3 gap-1">
                                <span>Pkg: {IDR(selectedOverhead.packaging_cost)}</span>
                                <span>Util: {IDR(selectedOverhead.utilities_cost)}</span>
                                <span>Other: {IDR(selectedOverhead.other_fixed)}</span>
                            </div>
                        )}
                    </div>

                    {/* save snapshot toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            {...register('save_snapshot')}
                            className="w-4 h-4 accent-amber-400"
                        />
                        <span className="text-xs text-stone-400">Save snapshot for history</span>
                    </label>

                    {calcMut.isError && (
                        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
                            {(calcMut.error as Error).message}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={calcMut.isPending}
                        className="bg-amber-400 text-stone-950 font-semibold text-sm py-2.5 rounded hover:bg-amber-300 disabled:opacity-50 transition-colors"
                    >
                        {calcMut.isPending ? 'Calculating…' : 'Calculate COGS'}
                    </button>
                </form>

                {/* ---- right: results ---- */}
                <div>
                    {!result && !calcMut.isPending && (
                        <div className="border border-dashed border-stone-800 rounded-lg px-6 py-24 text-center text-stone-600 text-sm">
                            Select a recipe and hit Calculate to see results
                        </div>
                    )}
                    {calcMut.isPending && (
                        <div className="border border-stone-800 rounded-lg px-6 py-24 text-center text-stone-500 text-sm">
                            Calculating…
                        </div>
                    )}
                    {result && !calcMut.isPending && <ResultsPanel result={result} />}
                </div>
            </div>

            {showOverheadModal && (
                <OverheadModal
                    onClose={() => setShowOverhead(false)}
                    onCreated={() => {
                        refetchOverheads()
                        setValue('overhead_id', '')
                    }}
                />
            )}
        </div>
    )
}