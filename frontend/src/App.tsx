import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import DashboardPage from '@/pages/DashboardPage'
import IngredientsPage from '@/pages/IngredientsPage'
import RecipesPage from '@/pages/RecipesPage'
import SuppliersPage from '@/pages/SuppliersPage'
import COGSPage from '@/pages/COGSPage'
import ComparisonPage from '@/pages/ComparisonPage'
import SimulatorPage from '@/pages/SimulatorPage'
import ProductionPage from '@/pages/ProductionPage'
import COGSHistoryPage from '@/pages/COGSHistoryPage'
import LaborPage from '@/pages/LaborPage'
import ProfitabilityPage from '@/pages/ProfitabilityPage'
import UsageReportPage from '@/pages/UsageReportPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="cogs" element={<COGSPage />} />
          <Route path="comparison" element={<ComparisonPage />} />
          <Route path="simulator" element={<SimulatorPage />} />
          <Route path="production" element={<ProductionPage />} />
          <Route path="history" element={<COGSHistoryPage />} />
          <Route path="labor" element={<LaborPage />} />
          <Route path="profitability" element={<ProfitabilityPage />} />
          <Route path="usage" element={<UsageReportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}