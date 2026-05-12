import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import CarsPage from './pages/CarsPage'
import CarDetail from './pages/CarDetail'
import CarForm from './pages/CarForm'
import LeadsPage from './pages/LeadsPage'
import PublicSite from './pages/PublicSite'
import PublicCarPage from './pages/PublicCarPage'

export default function App() {
  return (
    <AppProvider>
      <Routes>
        {/* Публичный сайт */}
        <Route path="/site" element={<PublicSite />} />
        <Route path="/site/car/:id" element={<PublicCarPage />} />

        {/* CRM */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cars" element={<CarsPage />} />
          <Route path="cars/new" element={<CarForm />} />
          <Route path="cars/:id" element={<CarDetail />} />
          <Route path="cars/:id/edit" element={<CarForm />} />
          <Route path="leads" element={<LeadsPage />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}
