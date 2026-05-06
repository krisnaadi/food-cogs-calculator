import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ingredientsApi } from '@/lib/api'
import type { IngredientPayload } from '@/lib/api'

export function useIngredients() {
    return useQuery({
        queryKey: ['ingredients'],
        queryFn: ingredientsApi.list,
    })
}

export function useCreateIngredient() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: IngredientPayload) => ingredientsApi.create(data),
        onSuccess: (created) => {
            qc.invalidateQueries({ queryKey: ['ingredients'] })
            // invalidate history for this specific ingredient
            qc.invalidateQueries({ queryKey: ['price-history', created.id] })
        },
    })
}

export function useUpdateIngredient() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: IngredientPayload }) =>
            ingredientsApi.update(id, data),
        onSuccess: (updated) => {
            qc.invalidateQueries({ queryKey: ['ingredients'] })
            // invalidate this ingredient's price history so the modal reflects the new entry
            qc.invalidateQueries({ queryKey: ['price-history', updated.id] })
            // also refresh dashboard since top-ingredients prices changed
            qc.invalidateQueries({ queryKey: ['top-ingredients'] })
        },
    })
}

export function useDeleteIngredient() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => ingredientsApi.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['ingredients'] })
            qc.invalidateQueries({ queryKey: ['top-ingredients'] })
        },
    })
}