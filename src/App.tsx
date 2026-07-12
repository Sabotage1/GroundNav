import { Capacitor } from '@capacitor/core'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { PushbackPage } from './pages/PushbackPage'
import { TowerPage } from './pages/TowerPage'
import { VehiclePage } from './pages/VehiclePage'

export function App() {
  const nativeVehicleApp = Capacitor.isNativePlatform()
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={nativeVehicleApp ? <Navigate to="/vehicle" replace /> : <HomePage />} />
        <Route path="tower" element={<TowerPage />} />
        <Route path="pushback" element={<PushbackPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="vehicle" element={<VehiclePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
