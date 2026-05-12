import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Car } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { StatusBadge } from '../components/StatusBadge'
import { formatPrice, formatMileage, daysOnLot } from '../utils/helpers'
import { STATUSES, STATUS_LABELS } from '../data/mockData'

export default function CarsPage() {
  const { cars } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = cars.filter(c => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q || `${c.make} ${c.model} ${c.year} ${c.color}`.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Автомобили</h1>
        <button
          onClick={() => navigate('/cars/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Добавить авто
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Поиск по марке, модели..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {[['all', 'Все'], ...Object.entries(STATUSES).map(([, v]) => [v, STATUS_LABELS[v]])].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === val
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500 mb-4">{filtered.length} авто</p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Car size={48} className="mx-auto mb-3 opacity-30" />
          <p>Нет автомобилей</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Автомобиль</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Год / Пробег</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Цена</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Прибыль</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Дней</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(car => (
                  <tr
                    key={car.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/cars/${car.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{car.make} {car.model}</div>
                      <div className="text-xs text-gray-400">{car.color} · {car.transmission}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{car.year}</div>
                      <div className="text-xs text-gray-400">{formatMileage(car.mileage)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{formatPrice(car.salePrice)}</div>
                      <div className="text-xs text-gray-400">себ. {formatPrice(car.purchasePrice)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${car.salePrice - car.purchasePrice > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatPrice(car.salePrice - car.purchasePrice)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {daysOnLot(car.arrivalDate, car.saleDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={car.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
