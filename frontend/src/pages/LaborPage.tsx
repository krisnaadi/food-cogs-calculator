import { useState, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/Modal'
import { laborApi } from '@/lib/api'
import type { LaborProfile, LaborProfilePayload } from '@/lib/api'

const IDR = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const inputCls = 'bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors w-full'

const schema = z.object({
    role: z.string().min(1, 'Role is required'),
    hourly_rate: z.number().min(0),
})
type FormValues = z.infer<typeof schema>

// Labor calculator — compute total cost from profiles + minutes
const calcSchema = z.object({
    lines: z.array(z.object({
        profile_id: z.string().min(1),
        minutes: z.number().min(0),
    })),
})
type CalcForm = z.infer<typeof calcSchema>

function LaborCalculator({ profiles }: { profiles: LaborProfile[] }) {
    const { register, control, watch } = useForm<CalcForm>({
        defaultValues: { lines: [{ profile_id: '', minutes: 0 }] },
    })
    const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
    const lines = watch('lines')

    const total = useMemo(() => {
        return lines.reduce((sum, line) => {
            const profile = profiles.find(p => p.id === line.profile_id)
            if (!profile || !line.minutes) return sum
            return sum + (line.minutes / 60) * profile.hourly_rate
        }, 0)
    }, [lines, profiles])

    return (
        <div className="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <h2 className="text-xs text-stone-500 uppercase tracking-widest mb-4">Labor Cost Calculator</h2>
            <p className="text-xs text-stone-600 mb-4">
                Estimate total labor for a production run. Use this to fill in the COGS calculator.
            </p>

            <div className="flex flex-col gap-2 mb-4">
                {fields.map((field, i) => (
                    <div key={field.id} className="grid grid-cols-[1fr_100px_28px] gap-2 items-center">
                        <select {...register(`lines.${i}.profile_id`)}
                            className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-amber-400 transition-colors w-full">
                            <option value="">Select role…</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.role} ({IDR(p.hourly_rate)}/hr)
                                </option>
                            ))}
                        </select>
                        <div className="relative">
                            <input
                                {...register(`lines.${i}.minutes`, { valueAsNumber: true })}
                                type="number" min="0" placeholder="mins"
                                className={inputCls}
                            />
                        </div>
                        <button onClick={() => remove(i)}
                            className="text-stone-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between">
                <button
                    onClick={() => append({ profile_id: '', minutes: 0 })}
                    className="text-xs text-stone-400 hover:text-amber-400 transition-colors">
                    + Add role
                </button>
                <div className="text-right">
                    <p className="text-xs text-stone-500 uppercase tracking-widest">Total labor cost</p>
                    <p className="text-xl font-bold text-amber-400 tabular-nums">{IDR(total)}</p>
                </div>
            </div>
        </div>
    )
}

function ProfileForm({ defaultValues, onSubmit, loading }: {
    defaultValues?: Partial<FormValues>
    onSubmit: (v: FormValues) => void
    loading: boolean
}) {
    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues,
    })
    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
                <label className="text-xs text-stone-400 uppercase tracking-widest block mb-1">Role</label>
                <input {...register('role')} className={inputCls} placeholder="e.g. Head Baker, Assistant" />
                {errors.role && <p className="text-xs text-red-400 mt-1">{errors.role.message}</p>}
            </div>
            <div>
                <label className="text-xs text-stone-400 uppercase tracking-widest block mb-1">Hourly rate (IDR)</label>
                <input {...register('hourly_rate', { valueAsNumber: true })} type="number" min="0" className={inputCls} />
                {errors.hourly_rate && <p className="text-xs text-red-400 mt-1">{errors.hourly_rate.message}</p>}
            </div>
            <button type="submit" disabled={loading}
                className="bg-amber-400 text-stone-950 font-semibold text-sm py-2 rounded hover:bg-amber-300 disabled:opacity-50 transition-colors">
                {loading ? 'Saving…' : 'Save Profile'}
            </button>
        </form>
    )
}

export default function LaborPage() {
    const qc = useQueryClient()
    const { data: profiles = [], isLoading } = useQuery({
        queryKey: ['labor-profiles'],
        queryFn: laborApi.list,
    })

    const createMut = useMutation({
        mutationFn: laborApi.create,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['labor-profiles'] }); setShowCreate(false) },
    })
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: LaborProfilePayload }) => laborApi.update(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['labor-profiles'] }); setEditing(null) },
    })
    const deleteMut = useMutation({
        mutationFn: laborApi.delete,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['labor-profiles'] }); setConfirmDelete(null) },
    })

    const [showCreate, setShowCreate] = useState(false)
    const [editing, setEditing] = useState<LaborProfile | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<LaborProfile | null>(null)

    return (
        <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-stone-100">Labor Profiles</h1>
                    <p className="text-sm text-stone-500 mt-1">Define roles and hourly rates for production cost estimation</p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="bg-amber-400 text-stone-950 text-sm font-semibold px-4 py-2 rounded hover:bg-amber-300 transition-colors">
                    + Add Profile
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* profiles table */}
                <div>
                    {isLoading && <p className="text-stone-500 text-sm">Loading…</p>}
                    {!isLoading && profiles.length === 0 ? (
                        <div className="border border-dashed border-stone-800 rounded-lg px-6 py-12 text-center text-stone-600 text-sm">
                            No labor profiles yet. Add roles like "Head Baker" or "Assistant".
                        </div>
                    ) : (
                        <div className="border border-stone-800 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-stone-800 text-xs text-stone-500 uppercase tracking-widest">
                                        <th className="text-left px-4 py-3 font-medium">Role</th>
                                        <th className="text-right px-4 py-3 font-medium">Rate / hr</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {profiles.map((p, i) => (
                                        <tr key={p.id} className={`border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-stone-900/30'}`}>
                                            <td className="px-4 py-3 text-stone-100 font-medium">{p.role}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-amber-400 font-semibold">
                                                {IDR(p.hourly_rate)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => setEditing(p)}
                                                        className="text-xs text-stone-400 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-stone-800">Edit</button>
                                                    <button onClick={() => setConfirmDelete(p)}
                                                        className="text-xs text-stone-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-stone-800">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* calculator */}
                {profiles.length > 0 && <LaborCalculator profiles={profiles} />}
            </div>

            {showCreate && (
                <Modal title="New Labor Profile" onClose={() => setShowCreate(false)}>
                    <ProfileForm onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
                </Modal>
            )}
            {editing && (
                <Modal title="Edit Labor Profile" onClose={() => setEditing(null)}>
                    <ProfileForm
                        defaultValues={{ role: editing.role, hourly_rate: editing.hourly_rate }}
                        onSubmit={v => updateMut.mutate({ id: editing.id, data: v })}
                        loading={updateMut.isPending}
                    />
                </Modal>
            )}
            {confirmDelete && (
                <Modal title="Delete Profile" onClose={() => setConfirmDelete(null)}>
                    <p className="text-sm text-stone-300 mb-6">
                        Delete <span className="text-white font-semibold">{confirmDelete.role}</span>?
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setConfirmDelete(null)}
                            className="px-4 py-2 text-sm text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800 transition-colors">Cancel</button>
                        <button onClick={() => deleteMut.mutate(confirmDelete.id)} disabled={deleteMut.isPending}
                            className="px-4 py-2 text-sm bg-red-500 text-white font-semibold rounded hover:bg-red-400 disabled:opacity-50 transition-colors">
                            {deleteMut.isPending ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}