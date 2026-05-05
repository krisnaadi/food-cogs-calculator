import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Modal from '@/components/Modal'
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '@/hooks/useSuppliers'
import { useQuery } from '@tanstack/react-query'
import { suppliersApi } from '@/lib/api'
import type { Supplier } from '@/lib/api'

const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    contact: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const inputCls = 'bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400 transition-colors w-full'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-stone-400 uppercase tracking-widest">{label}</label>
            {children}
            {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
    )
}

function SupplierForm({ defaultValues, onSubmit, loading }: {
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
            <Field label="Supplier name" error={errors.name?.message}>
                <input {...register('name')} className={inputCls} placeholder="e.g. PT Surya Flour Mills" />
            </Field>
            <Field label="Contact (phone / email / address)" error={errors.contact?.message}>
                <textarea
                    {...register('contact')}
                    className={`${inputCls} resize-none`}
                    rows={3}
                    placeholder="e.g. 0812-3456-7890 · supplier@example.com"
                />
            </Field>
            <button
                type="submit"
                disabled={loading}
                className="bg-amber-400 text-stone-950 font-semibold text-sm py-2 rounded hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Saving…' : 'Save Supplier'}
            </button>
        </form>
    )
}

// Expandable ingredient list per supplier
function SupplierIngredients({ supplierId }: { supplierId: string }) {
    const { data = [], isLoading } = useQuery({
        queryKey: ['supplier-ingredients', supplierId],
        queryFn: () => suppliersApi.ingredients(supplierId),
    })

    const fmt = (n: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

    if (isLoading) return <p className="text-xs text-stone-500 px-5 py-3">Loading…</p>
    if (data.length === 0) return (
        <p className="text-xs text-stone-600 px-5 py-3 italic">No ingredients linked to this supplier.</p>
    )

    return (
        <table className="w-full text-xs">
            <thead>
                <tr className="text-stone-600 uppercase tracking-widest border-b border-stone-800">
                    <th className="text-left px-5 py-2 font-medium">Ingredient</th>
                    <th className="text-left px-4 py-2 font-medium">Unit</th>
                    <th className="text-right px-5 py-2 font-medium">Price / unit</th>
                    <th className="text-right px-5 py-2 font-medium">Waste %</th>
                </tr>
            </thead>
            <tbody>
                {data.map(ing => (
                    <tr key={ing.id} className="border-b border-stone-800/40 hover:bg-stone-800/20">
                        <td className="px-5 py-2 text-stone-300">{ing.name}</td>
                        <td className="px-4 py-2 text-stone-500">{ing.unit}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-amber-400">{fmt(ing.price_per_unit)}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-stone-500">
                            {(ing.waste_pct * 100).toFixed(1)}%
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function SupplierCard({ supplier, onEdit, onDelete }: {
    supplier: Supplier; onEdit: () => void; onDelete: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    return (
        <div className="border border-stone-800 rounded-lg overflow-hidden hover:border-stone-700 transition-colors">
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="text-stone-500 hover:text-stone-300 transition-colors text-xs w-4"
                    >
                        {expanded ? '▼' : '▶'}
                    </button>
                    <div>
                        <p className="text-stone-100 font-medium text-sm">{supplier.name}</p>
                        {supplier.contact && (
                            <p className="text-xs text-stone-500 mt-0.5 whitespace-pre-line">{supplier.contact}</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-1">
                    <button onClick={onEdit} className="text-xs text-stone-400 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-stone-800">Edit</button>
                    <button onClick={onDelete} className="text-xs text-stone-400 hover:text-red-400  transition-colors px-2 py-1 rounded hover:bg-stone-800">Delete</button>
                </div>
            </div>
            {expanded && (
                <div className="border-t border-stone-800">
                    <SupplierIngredients supplierId={supplier.id} />
                </div>
            )}
        </div>
    )
}

export default function SuppliersPage() {
    const { data: suppliers = [], isLoading, isError } = useSuppliers()
    const createMut = useCreateSupplier()
    const updateMut = useUpdateSupplier()
    const deleteMut = useDeleteSupplier()

    const [showCreate, setShowCreate] = useState(false)
    const [editing, setEditing] = useState<Supplier | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null)

    const handleCreate = (v: FormValues) =>
        createMut.mutate(v, { onSuccess: () => setShowCreate(false) })

    const handleUpdate = (v: FormValues) => {
        if (!editing) return
        updateMut.mutate({ id: editing.id, data: v }, { onSuccess: () => setEditing(null) })
    }

    const handleDelete = () => {
        if (!confirmDelete) return
        deleteMut.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })
    }

    return (
        <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-stone-100">Suppliers</h1>
                    <p className="text-sm text-stone-500 mt-1">Manage your ingredient suppliers</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="bg-amber-400 text-stone-950 text-sm font-semibold px-4 py-2 rounded hover:bg-amber-300 transition-colors"
                >
                    + Add Supplier
                </button>
            </div>

            {isLoading && <p className="text-stone-500 text-sm">Loading…</p>}
            {isError && (
                <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-4 py-3">
                    Failed to load suppliers.
                </div>
            )}

            {!isLoading && !isError && (
                suppliers.length === 0
                    ? (
                        <div className="border border-dashed border-stone-800 rounded-lg px-6 py-16 text-center text-stone-600 text-sm">
                            No suppliers yet. Add one to link ingredients to a source.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {suppliers.map(s => (
                                <SupplierCard
                                    key={s.id}
                                    supplier={s}
                                    onEdit={() => setEditing(s)}
                                    onDelete={() => setConfirmDelete(s)}
                                />
                            ))}
                            <p className="text-xs text-stone-600 mt-1">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
                        </div>
                    )
            )}

            {showCreate && (
                <Modal title="New Supplier" onClose={() => setShowCreate(false)}>
                    <SupplierForm onSubmit={handleCreate} loading={createMut.isPending} />
                </Modal>
            )}

            {editing && (
                <Modal title="Edit Supplier" onClose={() => setEditing(null)}>
                    <SupplierForm
                        defaultValues={{ name: editing.name, contact: editing.contact ?? '' }}
                        onSubmit={handleUpdate}
                        loading={updateMut.isPending}
                    />
                </Modal>
            )}

            {confirmDelete && (
                <Modal title="Delete Supplier" onClose={() => setConfirmDelete(null)}>
                    <p className="text-sm text-stone-300 mb-6">
                        Delete <span className="text-white font-semibold">{confirmDelete.name}</span>?
                        Ingredients linked to this supplier will not be deleted, but will lose their supplier reference.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800 transition-colors">Cancel</button>
                        <button onClick={handleDelete} disabled={deleteMut.isPending} className="px-4 py-2 text-sm bg-red-500 text-white font-semibold rounded hover:bg-red-400 disabled:opacity-50 transition-colors">
                            {deleteMut.isPending ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}