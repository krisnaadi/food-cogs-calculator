import { NavLink, Outlet } from 'react-router-dom'

const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/ingredients', label: 'Ingredients' },
    { to: '/recipes', label: 'Recipes' },
    { to: '/suppliers', label: 'Suppliers' },
    { to: '/cogs', label: 'COGS Calculator' },
    { to: '/comparison', label: 'Compare' },
    { to: '/simulator', label: 'What-If' },
    { to: '/production', label: 'Production Log' },
    { to: '/history', label: 'COGS History' },
]

export default function Layout() {
    return (
        <div className="min-h-screen bg-stone-950 text-stone-100 font-mono">
            {/* sidebar */}
            <aside className="fixed top-0 left-0 h-full w-56 bg-stone-900 border-r border-stone-800 flex flex-col">
                <div className="px-6 py-6 border-b border-stone-800">
                    <span className="text-xs text-stone-500 uppercase tracking-widest">cogs</span>
                    <h1 className="text-lg font-bold text-amber-400 leading-tight">Food Cost<br />Calculator</h1>
                </div>
                <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
                    {links.map(({ to, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `px-3 py-2 rounded text-sm transition-colors ${isActive
                                    ? 'bg-amber-400 text-stone-950 font-semibold'
                                    : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
                                }`
                            }
                        >
                            {label}
                        </NavLink>
                    ))}
                </nav>
                <div className="px-6 py-4 border-t border-stone-800">
                    <span className="text-xs text-stone-600">v0.1.0 local</span>
                </div>
            </aside>

            {/* main */}
            <main className="ml-56 min-h-screen p-8">
                <Outlet />
            </main>
        </div>
    )
}