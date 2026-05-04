import { useEffect } from 'react'

interface Props {
    title: string
    onClose: () => void
    children: React.ReactNode
}

export default function Modal({ title, onClose, children }: Props) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative z-10 w-full max-w-lg bg-stone-900 border border-stone-700 rounded-lg shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 shrink-0">
                    <h2 className="text-sm font-semibold text-stone-100 uppercase tracking-widest">{title}</h2>
                    <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">&times;</button>
                </div>
                <div className="px-6 py-5 overflow-y-auto">{children}</div>
            </div>
        </div>
    )
}