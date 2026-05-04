import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import IngredientsPage from '@/pages/IngredientsPage'
import RecipesPage from '@/pages/RecipesPage'
import COGSPage from '@/pages/COGSPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/ingredients" replace />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="cogs" element={<COGSPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}