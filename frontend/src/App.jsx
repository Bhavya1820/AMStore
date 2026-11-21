import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { GuestRoute, ProtectedRoute, RequirePermission } from './components/guards'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Stores from './pages/Stores'
import Inventory from './pages/Inventory'
import Parties from './pages/Parties'
import Purchases from './pages/Purchases'
import CreatePurchase from './pages/CreatePurchase'
import PurchaseReturns from './pages/PurchaseReturns'
import CreatePurchaseReturn from './pages/CreatePurchaseReturn'
import ChangePassword from './pages/ChangePassword'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route
                  path="/inventory"
                  element={
                    <RequirePermission permission="item:view">
                      <Inventory />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/parties"
                  element={
                    <RequirePermission permission="party:manage">
                      <Parties />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/purchases"
                  element={
                    <RequirePermission permission="purchase:view">
                      <Purchases />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/purchases/new"
                  element={
                    <RequirePermission permission="purchase:create">
                      <CreatePurchase />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/purchase-returns"
                  element={
                    <RequirePermission anyOf={['purchase_return:view', 'purchase_return:create']}>
                      <PurchaseReturns />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/purchase-returns/new"
                  element={
                    <RequirePermission permission="purchase_return:create">
                      <CreatePurchaseReturn />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/facilities"
                  element={
                    <RequirePermission permission="store:manage">
                      <Stores />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RequirePermission permission="user:view">
                      <Users />
                    </RequirePermission>
                  }
                />
                <Route path="/change-password" element={<ChangePassword />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
