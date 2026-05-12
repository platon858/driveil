import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Car, Users, Globe, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Панель' },
  { to: '/cars', icon: Car, label: 'Автомобили' },
  { to: '/leads', icon: Users, label: 'Клиенты' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 bg-gray-900 text-white flex flex-col
        transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg leading-tight">AutoCRM</div>
            <div className="text-xs text-gray-400">Управление автопарком</div>
          </div>
          <button className="lg:hidden text-gray-400" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Public site link */}
        <div className="px-3 pb-4">
          <button
            onClick={() => { navigate('/site'); setOpen(false) }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
          >
            <Globe size={18} />
            Сайт для клиентов
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="text-gray-500">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-gray-800">AutoCRM</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
