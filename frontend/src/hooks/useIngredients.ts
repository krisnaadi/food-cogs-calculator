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
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
    })
}

export function useUpdateIngredient() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: IngredientPayload }) =>
            ingredientsApi.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
    })
}

export function useDeleteIngredient() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => ingredientsApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
    })
}