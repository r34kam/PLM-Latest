import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Login from '@/routes/Login'
import ForgotPassword from '@/routes/ForgotPassword'
import UpdatePassword from '@/routes/UpdatePassword'
import TopconPLM from '@/TopconPLM'
import Home from '@/pages/Home'
import Ecos from '@/pages/Ecos'
import Items from '@/pages/Items'
import Suppliers from '@/pages/Suppliers'
import Admin from '@/pages/Admin'
import EcoNew from '@/pages/EcoNew'
import ItemNewPage from '@/pages/ItemNew'
import InactivatePage from '@/pages/Inactivate'
import { Skeleton } from '@/components/ui/skeleton'

const Reports = lazy(() => import('@/pages/Reports'))

// BrowserRouter (clean URLs, no #). The mount path is never hardcoded here — the engine
// bakes it in as Vite's `base` (VITE_APP_BASE, see vite.config.ts) and the app reads it
// back as BASE_URL, so one value covers every slot it serves. A deploy build bakes '/'
// (the app's domain root → basename normalizes to undefined = root); a preview slot bakes
// its /agent-api/… path. The trailing slash goes because react-router rejects '/a/b'
// against basename '/a/b/'.
const APP_BASE = import.meta.env.BASE_URL
const basename = (APP_BASE.startsWith('/') ? APP_BASE.replace(/\/+$/, '') : '') || undefined

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/ecos" element={<Ecos />} />
        <Route path="/items" element={<Items />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/reports" element={<Suspense fallback={<Skeleton className="h-full w-full" />}><Reports /></Suspense>} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/ecos/new" element={<EcoNew />} />
        <Route path="/items/new" element={<ItemNewPage />} />
        <Route path="/items/inactivate" element={<InactivatePage />} />
        <Route path="/inactivate" element={<InactivatePage />} />
        <Route path="*" element={<TopconPLM />} />
      </Routes>
    </BrowserRouter>
  )
}
