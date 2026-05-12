import { useState } from 'react'
import { Plus, Users, Phone, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { LeadStatusBadge } from '../components/StatusBadge'
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '../data/mockData'

function LeadModal({ lead, cars, onSave, onClose }) {
  const [form, setForm] = useState(lead || {
    name: '', phone: '', carId: '', status: LEAD_STATUSES.NEW, note: ''
  })

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, carId: form.carId || null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900">{lead ? 'Редактировать клиента' : 'Добавить клиента'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Имя клиента"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+972..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Интерес к машине</label>
            <select
              value={form.carId || ''}
              onChange={e => set('carId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— не указано —</option>
              {cars.map(c => (
                <option key={c.id} value={c.id}>{c.make} {c.model} {c.year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {Object.entries(LEAD_STATUSES).map(([, v]) => (
                <option key={v} value={v}>{LEAD_STATUS_LABELS[v]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Заметка</label>
            <textarea
              value={form.note}
              onChange={e => set('note', e.target.value)}
              rows={2}
              placeholder="Детали переговоров..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              {lead ? 'Сохранить' : 'Добавить'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const { cars, leads, addLead, updateLead, deleteLead } = useApp()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null) // null | 'new' | lead object
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = leads.filter(l => filterStatus === 'all' || l.status === filterStatus)

  function handleSave(data) {
    if (modal && modal !== 'new') {
      updateLead(modal.id, data)
    } else {
      addLead(data)
    }
    setModal(null)
  }

  function getCarName(carId) {
    const c = cars.find(c => c.id === carId)
    return c ? `${c.make} ${c.model} ${c.year}` : null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Клиенты</h1>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[['all', 'Все'], ...Object.entries(LEAD_STATUSES).map(([, v]) => [v, LEAD_STATUS_LABELS[v]])].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilterStatus(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === val
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>Нет клиентов</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(lead => {
            const carName = getCarName(lead.carId)
            return (
              <div
                key={lead.id}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-200 transition-colors"
                onClick={() => setModal(lead)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">{lead.name}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Phone size={11} />
                      {lead.phone || 'нет телефона'}
                    </div>
                  </div>
                  <LeadStatusBadge status={lead.status} />
                </div>

                {carName && (
                  <div
                    className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-2 w-fit"
                    onClick={e => { e.stopPropagation(); const c = cars.find(c => c.id === lead.carId); if (c) navigate(`/cars/${c.id}`) }}
                  >
                    {carName}
                  </div>
                )}

                {lead.note && (
                  <p className="text-xs text-gray-600 line-clamp-2">{lead.note}</p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">{lead.createdAt}</span>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm('Удалить клиента?')) deleteLead(lead.id) }}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <LeadModal
          lead={modal === 'new' ? null : modal}
          cars={cars}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
