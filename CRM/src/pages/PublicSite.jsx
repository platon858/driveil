import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, MessageCircle, Search, SlidersHorizontal, ArrowLeft, Car } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatPrice, formatMileage } from '../utils/helpers'
import { STATUSES } from '../data/mockData'

const BUSINESS_PHONE = '+972501234567'
const BUSINESS_NAME = 'AutoSales'

export default function PublicSite() {
  const { cars } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterMake, setFilterMake] = useState('')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')
  const [filterMaxYear, setFilterMaxYear] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const available = cars.filter(c => c.status === STATUSES.FOR_SALE)
  const makes = [...new Set(available.map(c => c.make))].sort()

  const filtered = available.filter(c => {
    if (filterMake && c.make !== filterMake) return false
    if (filterMaxPrice && c.salePrice > Number(filterMaxPrice)) return false
    if (filterMaxYear && c.year < Number(filterMaxYear)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${c.make} ${c.model} ${c.year} ${c.color}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="font-bold text-gray-900 text-lg">{BUSINESS_NAME}</div>
              <div className="text-xs text-gray-400">Продажа автомобилей</div>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/${BUSINESS_PHONE.replace(/\D/g,'')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <MessageCircle size={15} />
              WhatsApp
            </a>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <Phone size={15} />
              Звонок
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Search + filter bar */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Поиск по марке, модели..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            <SlidersHorizontal size={15} />
            Фильтры
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Марка</label>
              <select
                value={filterMake}
                onChange={e => setFilterMake(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Все марки</option>
                {makes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Цена до (₪)</label>
              <input
                type="number"
                placeholder="80000"
                value={filterMaxPrice}
                onChange={e => setFilterMaxPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Год от</label>
              <input
                type="number"
                placeholder="2018"
                value={filterMaxYear}
                onChange={e => setFilterMaxYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Count */}
        <p className="text-sm text-gray-500 mb-4">{filtered.length} авто в наличии</p>

        {/* Cars grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Car size={56} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Нет доступных автомобилей</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(car => (
              <div
                key={car.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
                onClick={() => navigate(`/site/car/${car.id}`)}
              >
                {/* Photo placeholder */}
                <div className="h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Car size={48} className="text-gray-300" />
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">
                    {car.make} {car.model}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {car.year} · {formatMileage(car.mileage)} · {car.transmission}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-blue-700">{formatPrice(car.salePrice)}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{car.color}</span>
                  </div>

                  {car.location && (
                    <p className="text-xs text-gray-400 mt-2">📍 {car.location}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
