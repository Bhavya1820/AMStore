import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { IconPlus, IconShield, IconStore, IconUsers } from '../components/Icons'
import { MODULE_LABELS, ROLE_LABELS } from '../utils/helpers'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { user, permissions, has } = useAuth()
  const [stores, setStores] = useState([])
  const [users, setUsers] = useState(null)
  const canSeeUsers = has('user:view')

  useEffect(() => {
    let alive = true
    api.get('/stores').then((d) => alive && setStores(d.stores)).catch(() => {})
    if (canSeeUsers) {
      api.get('/users?limit=100').then((d) => alive && setUsers(d.users)).catch(() => alive && setUsers([]))
    }
    return () => {
      alive = false
    }
  }, [canSeeUsers])

  const stats = useMemo(() => {
    if (!users) return null
    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      admins: users.filter((u) => u.role === 'admin').length,
      staff: users.filter((u) => u.role === 'sales' || u.role === 'purchase').length,
    }
  }, [users])

  const grouped = useMemo(() => {
    const groups = {}
    for (const key of permissions) {
      const [module, action] = key.split(':')
      ;(groups[module] ||= []).push(action)
    }
    return Object.entries(groups)
  }, [permissions])

  const isManager = user.role === 'owner' || user.role === 'admin'

  return (
    <>
      <section className="welcome" aria-labelledby="welcome-title">
        <h2 id="welcome-title">{greeting()}, {user.userName} 👋</h2>
        <p>
          {isManager
            ? 'Manage your facilities and team from here.'
            : 'Here is a quick look at your workspace.'}
        </p>
        <div className="badges">
          <span className={`badge ${user.role}`}>{ROLE_LABELS[user.role]}</span>
          {stores.length > 0 && (
            <span className="badge">
              <IconStore size={14} /> {stores.length === 1 ? stores[0].name : `${stores.length} stores`}
            </span>
          )}
        </div>
      </section>

      {canSeeUsers && (
        <div className="grid-stats" aria-label="Team summary">
          {[
            { icon: <IconUsers />, num: stats?.total, label: 'Total users' },
            { icon: <IconShield />, num: stats?.active, label: 'Active users' },
            { icon: <IconUsers />, num: stats?.admins, label: 'Facility admins' },
            { icon: <IconStore />, num: stores.length, label: stores.length === 1 ? 'Store' : 'Stores' },
          ].map((s) => (
            <div key={s.label} className="card stat">
              <div className="ico">{s.icon}</div>
              <div>
                {s.num === undefined ? <div className="skeleton" style={{ width: 40, height: 28 }} /> : <div className="num">{s.num}</div>}
                <div className="lbl">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="two-col">
        <section className="card" aria-labelledby="access-title">
          <h3 id="access-title">Your access</h3>
          <p className="muted">Features enabled for your account.</p>
          {grouped.length === 0 ? (
            <p className="muted" style={{ marginTop: 14 }}>No features enabled yet. Ask your admin for access.</p>
          ) : (
            <div style={{ marginTop: 14 }}>
              {grouped.map(([module, actions]) => (
                <div key={module} className="perm-group">
                  <h4>{MODULE_LABELS[module] ?? module}</h4>
                  <div className="chips">
                    {actions.map((a) => (
                      <span key={a} className="chip">{a.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="stores-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h3 id="stores-title">{stores.length > 1 ? 'Your facilities' : 'Your facility'}</h3>
            {has('store:manage') && (
              <Link to="/facilities" className="btn btn-sm btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                <IconPlus size={14} /> Add / View All
              </Link>
            )}
          </div>
          <p className="muted">Share the store code with staff so they can sign in.</p>
          <div style={{ marginTop: 10 }}>
            {stores.map((s) => (
              <div key={s.id} className="store-row">
                <div>
                  <strong>{s.name}</strong>
                  {s.address && <div className="muted">{s.address}</div>}
                </div>
                <span className="code-pill">{s.storeCode}</span>
              </div>
            ))}
            {stores.length === 0 && <div className="skeleton" style={{ marginTop: 12 }} />}
          </div>
          {!isManager && (
            <div className="soon">
              <div className="big">🧁</div>
              More modules are on their way.
            </div>
          )}
        </section>
      </div>
    </>
  )
}
