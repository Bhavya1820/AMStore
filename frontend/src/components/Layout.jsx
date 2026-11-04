import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../utils/helpers'
import { BrandMark, IconDashboard, IconKey, IconLogout, IconMenu, IconStore, IconUsers } from './Icons'

const TITLES = {
  '/dashboard': 'Dashboard',
  '/facilities': 'Facilities',
  '/users': 'Users',
  '/change-password': 'Change password',
}

export default function Layout() {
  const { user, has, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  // A user on a temporary password sees no navigation until they change it
  const locked = user.mustChangePassword

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // Navigation items:
  // - Sales/purchase staff only get the dashboard
  // - Owner and facility admin get Users (user:view)
  // - Owner gets Facilities (store:manage)
  const nav = [
    { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard />, show: true },
    { to: '/facilities', label: 'Facilities', icon: <IconStore />, show: has('store:manage') },
    { to: '/users', label: 'Users', icon: <IconUsers />, show: has('user:view') },
  ].filter((n) => n.show)

  const initial = (user.userName || '?').charAt(0).toUpperCase()

  const signOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <div className={`backdrop-mobile${open ? ' show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark"><BrandMark /></span>
          AM Store
        </div>
        {!locked && (
          <>
            <div className="nav-label">Menu</div>
            <nav className="nav">
              {nav.map((n) => (
                <NavLink key={n.to} id={`nav-${n.label.toLowerCase()}`} to={n.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  {n.icon}
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-foot">
          <div className="name">{user.userName}</div>
          <div className="role">{ROLE_LABELS[user.role]}</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!locked && (
              <button className="btn-icon menu-toggle" aria-label="Open menu" onClick={() => setOpen(true)}>
                <IconMenu />
              </button>
            )}
            <h1>{TITLES[location.pathname] ?? 'AM Store'}</h1>
          </div>
          <div className="topbar-actions">
            <div className="user-menu" ref={menuRef}>
              <button id="user-menu-button" className="user-trigger" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
                <span className="avatar">{initial}</span>
                <span className="u-name">{user.userName}</span>
              </button>
              {menu && (
                <div className="dropdown" role="menu">
                  <div className="head">
                    <strong>{user.userName}</strong>
                    <small>{user.email || ROLE_LABELS[user.role]}</small>
                  </div>
                  <button
                    id="menu-change-password"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false)
                      navigate('/change-password')
                    }}
                  >
                    <IconKey size={18} /> Change password
                  </button>
                  <button id="menu-logout" role="menuitem" onClick={signOut}>
                    <IconLogout size={18} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
