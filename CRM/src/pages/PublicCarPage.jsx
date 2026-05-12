import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MessageCircle, MapPin, Car } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatPrice, formatMileage, shareToWhatsApp } from '../utils/helpers'
import { STATUSES } from '../data/mockData'

const BUSINESS_PHONE = '+972501234567'

export default function PublicCarPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cars } = useApp()

  const car = cars.find(c => c.id === Number(id))

  if (!car || car.status !== STATUSES.FOR_SALE) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Car size={64} className="mx-auto mb-4 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-700 mb-2">Автомобиль не найден</h1>
          <p className="text-gray-500 mb-4">Возможно, он уже продан</p>
          <button onClick={() => navigate('/site')} className="text-blue-600 text-sm">← Все автомобили</button>
        </div>
      </div>
    )
  }

  const waText = `Здравствуйте! Интересует ${car.make} ${car.model} ${car.year}, ${formatPrice(car.salePrice)}`
  const waUrl = `https://wa.me/${BUSINESS_PHONE.replace(/\D/g,'')}?text=${encodeURIComponent(waText)}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/site')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <span className="font-semibold text-gray-800">{car.make} {car.model} {car.year}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Photo placeholder */}
        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl h-64 sm:h-80 flex items-center justify-center mb-5">
          <Car size={80} className="text-gray-300" />
        </div>

        {/* Title + price */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {car.make} {car.model} {car.year}
          </h1>
          {car.location && (
            <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
              <MapPin size={14} />
              {car.location}
            </div>
          )}
          <div className="text-3xl font-bold text-blue-700">{formatPrice(car.salePrice)}</div>
        </div>

        {/* Specs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Характеристики</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              ['Год', car.year],
              ['Пробег', formatMileage(car.mileage)],
              ['КПП', car.transmission],
              ['Двигатель', car.engine ? `${car.engine} л` : '—'],
              ['Цвет', car.color || '—'],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">{label}</div>
                <div className="text-sm font-semibold text-gray-800">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        {car.description && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="font-semibold text-gray-900 mb-2">Описание</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{car.description}</p>
          </div>
        )}

        {/* CTA */}
        <div className="sticky bottom-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-lg flex gap-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <MessageCircle size={18} />
              Написать в WhatsApp
            </a>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Phone size={18} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
