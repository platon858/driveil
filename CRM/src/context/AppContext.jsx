import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { STATUSES } from '../data/mockData'

const AppContext = createContext(null)

function carFromDb(row) {
  return {
    id: row.id,
    make: row.brand,
    model: row.model,
    year: row.year,
    mileage: row.mileage,
    color: row.color,
    transmission: row.transmission,
    engine: row.engine_volume,
    vin: row.vin,
    description: row.description,
    location: row.location,
    status: row.status,
    purchasePrice: row.price_buy,
    salePrice: row.price_sell,
    platforms: row.platforms || [],
    arrivalDate: row.created_at ? row.created_at.split('T')[0] : null,
    saleDate: null,
    photos: row.photos || [],
  }
}

function carToDb(car) {
  return {
    title: `${car.make} ${car.model} ${car.year}`,
    brand: car.make,
    model: car.model,
    year: car.year,
    mileage: car.mileage,
    color: car.color,
    transmission: car.transmission,
    engine_volume: car.engine,
    vin: car.vin,
    description: car.description,
    location: car.location,
    status: car.status,
    price_buy: car.purchasePrice,
    price_sell: car.salePrice,
    platforms: car.platforms || [],
    photos: car.photos || [],
  }
}

function leadFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    carId: row.car_id,
    status: row.status,
    note: row.notes,
    createdAt: row.created_at ? row.created_at.split('T')[0] : null,
  }
}

function leadToDb(lead) {
  return {
    car_id: lead.carId || null,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    notes: lead.note,
  }
}

export function AppProvider({ children }) {
  const [cars, setCars] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('cars').select('*').order('created_at', { ascending: false }),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
    ]).then(([carsRes, leadsRes]) => {
      if (carsRes.data) setCars(carsRes.data.map(carFromDb))
      if (leadsRes.data) setLeads(leadsRes.data.map(leadFromDb))
      setLoading(false)
    })
  }, [])

  async function addCar(car) {
    const { data, error } = await supabase.from('cars').insert(carToDb(car)).select().single()
    if (error) throw error
    const newCar = carFromDb(data)
    setCars(prev => [newCar, ...prev])
    return newCar
  }

  async function updateCar(id, updates) {
    const current = cars.find(c => c.id === id)
    const merged = { ...current, ...updates }
    if (updates.status === STATUSES.SOLD && !current.saleDate) {
      merged.saleDate = new Date().toISOString().split('T')[0]
    }
    if (updates.status && updates.status !== STATUSES.SOLD) {
      merged.saleDate = null
    }
    setCars(prev => prev.map(c => c.id === id ? merged : c))
    const { error } = await supabase.from('cars').update(carToDb(merged)).eq('id', id)
    if (error) console.error(error)
  }

  async function deleteCar(id) {
    setCars(prev => prev.filter(c => c.id !== id))
    const { error } = await supabase.from('cars').delete().eq('id', id)
    if (error) console.error(error)
  }

  async function addLead(lead) {
    const { data, error } = await supabase.from('leads').insert(leadToDb(lead)).select().single()
    if (error) throw error
    setLeads(prev => [leadFromDb(data), ...prev])
  }

  async function updateLead(id, updates) {
    const merged = { ...leads.find(l => l.id === id), ...updates }
    setLeads(prev => prev.map(l => l.id === id ? merged : l))
    const { error } = await supabase.from('leads').update(leadToDb(merged)).eq('id', id)
    if (error) console.error(error)
  }

  async function deleteLead(id) {
    setLeads(prev => prev.filter(l => l.id !== id))
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) console.error(error)
  }

  return (
    <AppContext.Provider value={{ cars, leads, loading, addCar, updateCar, deleteCar, addLead, updateLead, deleteLead }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
