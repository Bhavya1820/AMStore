import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, ErrorAlert } from '../components/ui'
import { IconEdit, IconKey, IconPlus, IconPower, IconSearch, IconShield } from '../components/Icons'
import { ConfirmStatusModal, CreateUserModal, EditUserModal, PermissionsModal, ResetPasswordModal } from '../components/UserModals'
import { ROLE_LABELS, formatDate } from '../utils/helpers'

export default function Users() {
  const { user: me, has } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState(null)
  const [stores, setStores] = useState([])
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ q: '', role: '', status: '' })
  const [modal, setModal] = useState(null) // { type, user? }

  const canManage = has('user:manage')

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([api.get('/users?limit=100'), api.get('/stores')])
      setUsers(u.users)
      setStores(s.stores)
      setError(null)
    } catch (err) {
      setError(err)
      setUsers((prev) => prev ?? [])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const storeName = useMemo(() => Object.fromEntries(stores.map((s) => [s.id, s.name])), [stores])

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return (users ?? []).filter(
      (u) =>
        (!q || u.userName.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)) &&
        (!filters.role || u.role === filters.role) &&
        (!filters.status || (filters.status === 'active' ? u.isActive : !u.isActive)),
    )
  }, [users, filters])

  const close = () => setModal(null)
  const refreshWithToast = (message) => {
    if (message) toast.success(message)
    load()
  }

  // Owner row and your own row are never editable here; staff rows are editable only with user:manage
  const editable = (u) => canManage && !u.isOwner && u.id !== me.id

  const roleFilters = me.role === 'owner' ? ['admin', 'sales', 'purchase'] : ['sales', 'purchase']

  return (
    <>
      <div className="toolbar">
        <div className="input-wrap grow">
          <span className="lead"><IconSearch size={18} /></span>
          <input id="users-search" className="input" placeholder="Search by name or email" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} aria-label="Search users" />
        </div>
        <select id="users-role-filter" className="input" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))} aria-label="Filter by role">
          <option value="">All roles</option>
          {me.role === 'owner' && <option value="owner">Owner</option>}
          {roleFilters.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select id="users-status-filter" className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {canManage && (
          <Button id="add-user" variant="primary" onClick={() => setModal({ type: 'create' })}>
            <IconPlus size={18} /> Add user
          </Button>
        )}
      </div>

      <ErrorAlert error={error} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Store</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {users === null &&
              [1, 2, 3].map((i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5, 6].map((c) => <td key={c}><div className="skeleton" /></td>)}
                </tr>
              ))}
            {users !== null && filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty">
                    {users.length === 0 ? 'No users yet. Add your first team member.' : 'No users match your filters.'}
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} id={`user-row-${u.id}`}>
                <td>
                  <div className="cell-user">
                    <span className="avatar">{u.userName.charAt(0).toUpperCase()}</span>
                    <div>
                      <strong>{u.userName}{u.id === me.id && ' (you)'}</strong>
                      <small>{u.email ?? 'Signs in with store code'}</small>
                    </div>
                  </div>
                </td>
                <td><span className={`badge ${u.role}`}>{ROLE_LABELS[u.role]}</span></td>
                <td>
                  {u.storeIds.length === 0
                    ? 'All stores'
                    : u.storeIds.map((id) => storeName[id] ?? '—').join(', ')}
                </td>
                <td>
                  <span className={`badge ${u.isActive ? 'on' : 'off'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                  {u.mustChangePassword && <span className="badge" style={{ marginLeft: 6 }} title="Has not changed the temporary password yet">Pending</span>}
                </td>
                <td style={{ color: 'var(--ink-500)' }}>{formatDate(u.lastLoginAt)}</td>
                <td>
                  {editable(u) && (
                    <div className="row-actions">
                      {(u.role === 'sales' || u.role === 'purchase') && (
                        <button className="btn-icon" id={`perm-${u.id}`} title="Feature access" aria-label={`Feature access for ${u.userName}`} onClick={() => setModal({ type: 'perms', user: u })}>
                          <IconShield size={18} />
                        </button>
                      )}
                      <button className="btn-icon" id={`edit-${u.id}`} title="Edit" aria-label={`Edit ${u.userName}`} onClick={() => setModal({ type: 'edit', user: u })}>
                        <IconEdit size={18} />
                      </button>
                      <button className="btn-icon" id={`reset-${u.id}`} title="Reset password" aria-label={`Reset password for ${u.userName}`} onClick={() => setModal({ type: 'reset', user: u })}>
                        <IconKey size={18} />
                      </button>
                      <button className="btn-icon" id={`status-${u.id}`} title={u.isActive ? 'Deactivate' : 'Reactivate'} aria-label={`${u.isActive ? 'Deactivate' : 'Reactivate'} ${u.userName}`} onClick={() => setModal({ type: 'status', user: u })}>
                        <IconPower size={18} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.type === 'create' && <CreateUserModal me={me} stores={stores} onClose={close} onDone={() => load()} />}
      {modal?.type === 'edit' && <EditUserModal me={me} user={modal.user} stores={stores} onClose={close} onDone={refreshWithToast} />}
      {modal?.type === 'reset' && <ResetPasswordModal user={modal.user} stores={stores} onClose={close} onDone={() => load()} />}
      {modal?.type === 'perms' && <PermissionsModal user={modal.user} onClose={close} onDone={refreshWithToast} />}
      {modal?.type === 'status' && <ConfirmStatusModal user={modal.user} onClose={close} onDone={refreshWithToast} />}
    </>
  )
}
