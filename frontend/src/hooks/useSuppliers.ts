import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suppliersApi } from '@/lib/api'
import type { SupplierPayload } from '@/lib/api'

export function useSuppliers() {
    return useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
}

export function useCreateSupplier() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: SupplierPayload) => suppliersApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    })
}

export function useUpdateSupplier() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: SupplierPayload }) =>
            suppliersApi.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    })
}

export function useDeleteSupplier() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => suppliersApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    })
}