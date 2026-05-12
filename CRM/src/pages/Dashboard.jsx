import { useNavigate } from 'react-router-dom'
import { Car, TrendingUp, Clock, DollarSign, Users, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatPrice, daysOnLot } from '../utils/helpers'
import { STATUSES, STATUS_LABELS, STATUS_COLORS, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '../data/mockData'

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { cars, leads } = useApp()
  const navigate = useNavigate()

  const forSale = cars.filter(c => c.status === STATUSES.FOR_SALE)
  const reserved = cars.filter(c => c.status === STATUSES.RESERVED)
  const sold = cars.filter(c => c.status === STATUSES.SOLD)

  const totalProfit = sold.reduce((sum, c) => sum + (c.salePrice - c.purchasePrice), 0)
  const potentialProfit = forSale.reduce((sum, c) => sum + (c.salePrice - c.purchasePrice), 0)

  const avgSaleTime = sold.length > 0
    ? Math.round(sold.reduce((sum, c) => sum + daysOnLot(c.arrivalDate, c.saleDate), 0) / sold.length)
    : 0

  // Platform effectiveness
  const platformStats = {}
  cars.forEach(c => {
    c.platforms.forEach(p => {
      platformStats[p] = (platformStats[p] || 0) + 1
    })
  })
  const topPlatforms = Object.entries(platformStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Days on lot for active cars
  const activeCars = [...forSale, ...reserved].sort(
    (a, b) => daysOnLot(b.arrivalDate, null) - daysOnLot(a.arrivalDate, null)
  ).slice(0, 5)

  const recentLeads = leads.slice(0, 4)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Панель управления</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Car}
          label="На продаже"
          value={forSale.length}
          sub={reserved.length > 0 ? `${reserved.length} в резерве` : undefined}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Продано"
          value={sold.length}
          sub="всего машин"
          color="green"
        />
        <StatCard
          icon={DollarSign}
          label="Прибыль (продано)"
          value={formatPrice(totalProfit)}
          sub={`потенциал ${formatPrice(potentialProfit)}`}
          color="purple"
        />
        <StatCard
          icon={Clock}
          label="Ср. срок продажи"
          value={avgSaleTime ? `${avgSaleTime} дн.` : '—'}
          sub={sold.length > 0 ? `по ${sold.length} авто` : 'нет данных'}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Long on lot */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Дольше всего на складе</h2>
            <button onClick={() => navigate('/cars')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Все авто <ArrowRight size={12} />
            </button>
          </div>
          {activeCars.length === 0 ? (
            <p className="text-sm text-gray-400">Нет активных машин</p>
          ) : (
            <div className="space-y-3">
              {activeCars.map(car => {
                const days = daysOnLot(car.arrivalDate, null)
                const pct = Math.min(100, (days / 60) * 100)
                return (
                  <div
                    key={car.id}
                    className="cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
                    onClick={() => navigate(`/cars/${car.id}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">
                        {car.make} {car.model} {car.year}
                      </span>
                      <span className={`text-sm font-semibold ${days > 45 ? 'text-red-500' : days > 30 ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {days} дн.
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${days > 45 ? 'bg-red-400' : days > 30 ? 'bg-yellow-400' : 'bg-blue-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Platform stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Площадки</h2>
            {topPlatforms.length === 0 ? (
              <p className="text-sm text-gray-400">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {topPlatforms.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{name}</span>
                    <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent leads */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Клиенты</h2>
              <button onClick={() => navigate('/leads')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Все <ArrowRight size={12} />
              </button>
            </div>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-gray-400">Нет клиентов</p>
            ) : (
              <div className="space-y-2">
                {recentLeads.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-800 truncate">{lead.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${LEAD_STATUS_COLORS[lead.status]}`}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
