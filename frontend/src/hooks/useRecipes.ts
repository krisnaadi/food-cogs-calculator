import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recipesApi } from '@/lib/api'
import type { RecipePayload } from '@/lib/api'

export function useRecipes() {
    return useQuery({
        queryKey: ['recipes'],
        queryFn: recipesApi.list,
    })
}

export function useRecipe(id: string) {
    return useQuery({
        queryKey: ['recipes', id],
        queryFn: () => recipesApi.get(id),
        enabled: !!id,
    })
}

export function useCreateRecipe() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: RecipePayload) => recipesApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
    })
}

export function useUpdateRecipe() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: RecipePayload }) =>
            recipesApi.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
    })
}

export function useDeleteRecipe() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => recipesApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
    })
}