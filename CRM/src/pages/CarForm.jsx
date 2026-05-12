import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { STATUSES, STATUS_LABELS, PLATFORMS } from '../data/mockData'

const EMPTY = {
  make: '', model: '', year: new Date().getFullYear(), mileage: '',
  color: '', transmission: 'Автомат', engine: '',
  vin: '', description: '', location: '',
  status: STATUSES.FOR_SALE, purchasePrice: '', salePrice: '',
  platforms: [], arrivalDate: new Date().toISOString().split('T')[0],
  photos: [],
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      {children}
    </select>
  )
}

export default function CarForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cars, addCar, updateCar } = useApp()

  const existing = id ? cars.find(c => c.id === id) : null
  const [form, setForm] = useState(existing || EMPTY)
  const [errors, setErrors] = useState({})
  const [newFiles, setNewFiles] = useState([])
  const [uploading, setUploading] = useState(false)

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function togglePlatform(p) {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter(x => x !== p)
        : [...prev.platforms, p],
    }))
  }

  function validate() {
    const e = {}
    if (!form.make.trim()) e.make = 'Обязательное поле'
    if (!form.model.trim()) e.model = 'Обязательное поле'
    if (!form.year || form.year < 1990 || form.year > 2030) e.year = 'Некорректный год'
    if (!form.mileage || form.mileage < 0) e.mileage = 'Укажите пробег'
    if (!form.purchasePrice || form.purchasePrice <= 0) e.purchasePrice = 'Укажите себестоимость'
    if (!form.salePrice || form.salePrice <= 0) e.salePrice = 'Укажите цену продажи'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function uploadPhotos(carId) {
    const urls = []
    for (const file of newFiles) {
      const ext = file.name.split('.').pop()
      const path = `${carId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('car-photos').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('car-photos').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    }
    return urls
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    setUploading(true)
    try {
      const data = {
        ...form,
        year: Number(form.year),
        mileage: Number(form.mileage),
        engine: Number(form.engine),
        purchasePrice: Number(form.purchasePrice),
        salePrice: Number(form.salePrice),
      }

      if (existing) {
        const uploadedUrls = await uploadPhotos(existing.id)
        const photos = [...(existing.photos || []), ...uploadedUrls]
        await updateCar(existing.id, { ...data, photos })
        navigate(`/cars/${existing.id}`)
      } else {
        const newCar = await addCar({ ...data, photos: [] })
        const uploadedUrls = await uploadPhotos(newCar.id)
        if (uploadedUrls.length > 0) {
          await updateCar(newCar.id, { photos: uploadedUrls })
        }
        navigate(`/cars/${newCar.id}`)
      }
    } finally {
      setUploading(false)
    }
  }

  function removeExistingPhoto(url) {
    set('photos', form.photos.filter(p => p !== url))
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={16} />
        Назад
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {existing ? `Редактировать: ${existing.make} ${existing.model}` : 'Добавить автомобиль'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Основные данные</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Марка *" error={errors.make}>
              <Input value={form.make} onChange={e => set('make', e.target.value)} placeholder="Toyota" />
            </Field>
            <Field label="Модель *" error={errors.model}>
              <Input value={form.model} onChange={e => set('model', e.target.value)} placeholder="Camry" />
            </Field>
            <Field label="Год *" error={errors.year}>
              <Input type="number" value={form.year} onChange={e => set('year', e.target.value)} />
            </Field>
            <Field label="Пробег (км) *" error={errors.mileage}>
              <Input type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="89000" />
            </Field>
            <Field label="Цвет">
              <Input value={form.color} onChange={e => set('color', e.target.value)} placeholder="Серебристый" />
            </Field>
            <Field label="КПП">
              <Select value={form.transmission} onChange={e => set('transmission', e.target.value)}>
                <option>Автомат</option>
                <option>Механика</option>
                <option>Робот</option>
                <option>Вариатор</option>
              </Select>
            </Field>
            <Field label="Объём двигателя (л)">
              <Input type="number" step="0.1" value={form.engine} onChange={e => set('engine', e.target.value)} placeholder="2.0" />
            </Field>
            <Field label="VIN">
              <Input value={form.vin} onChange={e => set('vin', e.target.value)} placeholder="..." />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Местоположение">
              <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Тель-Авив" />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Описание">
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                placeholder="Состояние, особенности..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </Field>
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Фотографии</h2>

          {form.photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {form.photos.map(url => (
                <div key={url} className="relative group">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(url)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {newFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {newFiles.map((f, i) => (
                <div key={i} className="relative group">
                  <img src={URL.createObjectURL(f)} alt="" className="w-20 h-20 object-cover rounded-lg border border-blue-200" />
                  <button
                    type="button"
                    onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors w-fit">
            <Upload size={16} />
            Добавить фото
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => setNewFiles(prev => [...prev, ...Array.from(e.target.files)])}
            />
          </label>
        </div>

        {/* Finance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Финансы</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Себестоимость (₪) *" error={errors.purchasePrice}>
              <Input type="number" value={form.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} placeholder="38000" />
            </Field>
            <Field label="Цена продажи (₪) *" error={errors.salePrice}>
              <Input type="number" value={form.salePrice} onChange={e => set('salePrice', e.target.value)} placeholder="45000" />
            </Field>
          </div>
          {form.purchasePrice && form.salePrice && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Прибыль: </span>
              <span className={`text-sm font-bold ${form.salePrice - form.purchasePrice >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                ₪{(Number(form.salePrice) - Number(form.purchasePrice)).toLocaleString('ru-RU')}
              </span>
            </div>
          )}
        </div>

        {/* Status & Platforms */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Статус и площадки</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Статус">
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUSES).map(([, v]) => (
                  <option key={v} value={v}>{STATUS_LABELS[v]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Дата поступления">
              <Input type="date" value={form.arrivalDate} onChange={e => set('arrivalDate', e.target.value)} />
            </Field>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Площадки размещения</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    form.platforms.includes(p)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60"
          >
            {uploading ? 'Сохранение...' : existing ? 'Сохранить' : 'Добавить'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
