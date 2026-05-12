import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Share2, MapPin, Calendar, Gauge, Cog } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { StatusBadge } from '../components/StatusBadge'
import { formatPrice, formatMileage, daysOnLot, shareToWhatsApp } from '../utils/helpers'
import { STATUSES, STATUS_LABELS } from '../data/mockData'

export default function CarDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cars, updateCar, deleteCar } = useApp()

  const car = cars.find(c => c.id === id)

  if (!car) return (
    <div className="text-center py-20 text-gray-400">
      <p>Автомобиль не найден</p>
      <button onClick={() => navigate('/cars')} className="mt-3 text-blue-600 text-sm">← К списку</button>
    </div>
  )

  async function handleDelete() {
    if (confirm(`Удалить ${car.make} ${car.model}?`)) {
      await deleteCar(car.id)
      navigate('/cars')
    }
  }

  function handleShare() {
    const url = shareToWhatsApp(car, window.location.origin)
    window.open(url, '_blank')
  }

  const profit = car.salePrice - car.purchasePrice

  return (
    <div>
      {/* Back */}
      <button onClick={() => navigate('/cars')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={16} />
        К списку
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{car.make} {car.model}</h1>
              <StatusBadge status={car.status} />
            </div>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <MapPin size={14} />
              {car.location}
              <span>·</span>
              <Calendar size={14} />
              {daysOnLot(car.arrivalDate, car.saleDate)} дней {car.status === 'sold' ? 'на продаже' : 'на складе'}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Share2 size={15} />
              WhatsApp
            </button>
            <button
              onClick={() => navigate(`/cars/${car.id}/edit`)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <Edit size={15} />
              Изменить
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Photos */}
      {car.photos && car.photos.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {car.photos.map(url => (
            <img key={url} src={url} alt="" className="h-40 w-auto rounded-xl object-cover flex-shrink-0 border border-gray-200" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Characteristics */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Характеристики</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                ['Год', car.year],
                ['Пробег', formatMileage(car.mileage)],
                ['Цвет', car.color],
                ['КПП', car.transmission],
                ['Двигатель', `${car.engine} л`],
                ['VIN', car.vin || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                  <div className="text-sm font-medium text-gray-800">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          {car.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-2">Описание</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{car.description}</p>
            </div>
          )}

          {/* Platforms */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Площадки размещения</h2>
            <div className="flex flex-wrap gap-2">
              {car.platforms.length > 0
                ? car.platforms.map(p => (
                    <span key={p} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{p}</span>
                  ))
                : <span className="text-sm text-gray-400">Не указаны</span>
              }
            </div>
          </div>
        </div>

        {/* Finance + Status */}
        <div className="space-y-4">
          {/* Finance */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Финансы</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Себестоимость</span>
                <span className="text-sm font-medium text-gray-800">{formatPrice(car.purchasePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Цена продажи</span>
                <span className="text-sm font-medium text-gray-800">{formatPrice(car.salePrice)}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">Прибыль</span>
                <span className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatPrice(profit)}
                </span>
              </div>
            </div>
          </div>

          {/* Change status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Статус</h2>
            <div className="space-y-2">
              {Object.values(STATUSES).map(s => (
                <button
                  key={s}
                  onClick={() => updateCar(car.id, { status: s })}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    car.status === s
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Даты</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Поступление</span>
                <span className="text-gray-800">{car.arrivalDate}</span>
              </div>
              {car.saleDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Продана</span>
                  <span className="text-gray-800">{car.saleDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
