import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { Button, CopyButton, ErrorAlert, Field, Modal, PasswordField, TextField } from './ui'
import { IconMail, IconUser } from './Icons'
import { MODULE_LABELS, ROLE_LABELS, generatePassword, isEmail, validatePassword } from '../utils/helpers'

/* ------------------------- shared credentials card ------------------------- */

function Credentials({ user, storeCode, password }) {
  const lines = [
    ['Sign in at', `${window.location.origin}/login`],
    ...(user.email ? [['Email', user.email]] : []),
    ...(storeCode && user.role !== 'admin' ? [['Store code', storeCode], ['Username', user.userName]] : []),
    ['Temporary password', password],
  ]
  const text = lines.map(([k, v]) => `${k}: ${v}`).join('\n')
  return (
    <>
      <div className="alert alert-success">Done. Share these details with {user.userName}. They must choose a new password on first sign-in.</div>
      <div className="creds" id="credentials-card">
        {lines.map(([k, v]) => (
          <div className="row" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <CopyButton id="copy-credentials" text={text} label="Copy details" />
      </div>
    </>
  )
}

/* ------------------------------- create user ------------------------------- */

export function CreateUserModal({ me, stores, onClose, onDone }) {
  const roles = me.role === 'owner' ? ['admin', 'sales', 'purchase'] : ['sales', 'purchase']
  const [form, setForm] = useState({ role: roles[roles.length - 2] ?? 'sales', userName: '', email: '', password: '', storeId: stores[0]?.id ?? '', storeIds: [] })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const isAdminRole = form.role === 'admin'

  const toggleStore = (id) =>
    setForm((f) => ({ ...f, storeIds: f.storeIds.includes(id) ? f.storeIds.filter((s) => s !== id) : [...f.storeIds, id] }))

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    const next = {}
    if (form.userName.trim().length < 2) next.userName = 'Enter a name (min 2 characters)'
    if (isAdminRole && !isEmail(form.email.trim())) next.email = 'A valid email is required for admins'
    if (!isAdminRole && form.email.trim() && !isEmail(form.email.trim())) next.email = 'Enter a valid email'
    const pw = validatePassword(form.password)
    if (pw) next.password = pw
    if (isAdminRole && form.storeIds.length === 0) next.stores = 'Select at least one store'
    if (!isAdminRole && !form.storeId) next.stores = 'Select a store'
    setErrors(next)
    if (Object.keys(next).length) return

    const payload = { role: form.role, userName: form.userName.trim(), password: form.password }
    if (form.email.trim()) payload.email = form.email.trim().toLowerCase()
    if (isAdminRole) payload.storeIds = form.storeIds
    else payload.storeId = form.storeId

    setLoading(true)
    try {
      const data = await api.post('/users', payload)
      setCreated({ user: data.user, password: form.password })
      onDone()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  if (created) {
    const store = stores.find((s) => created.user.storeIds.includes(s.id))
    return (
      <Modal title="User created" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
        <Credentials user={created.user} storeCode={store?.storeCode} password={created.password} />
      </Modal>
    )
  }

  return (
    <Modal
      title="Add user"
      subtitle="They'll sign in with the temporary password and be asked to change it."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button id="create-user-submit" type="submit" form="create-user-form" variant="primary" loading={loading}>Create user</Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />
        <div className="form-grid">
          <Field label="Role" htmlFor="cu-role">
            <select id="cu-role" className="input" value={form.role} onChange={set('role')}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <TextField id="cu-username" label={isAdminRole ? 'Full name' : 'Username'} icon={<IconUser size={18} />} value={form.userName} onChange={set('userName')} error={errors.userName} autoComplete="off" />
          <div className="span-2">
            <TextField id="cu-email" label={isAdminRole ? 'Email' : 'Email (optional)'} type="email" icon={<IconMail size={18} />} value={form.email} onChange={set('email')} error={errors.email} autoComplete="off" hint={isAdminRole ? 'Admins sign in with their email.' : 'Staff can also sign in with store code + username.'} />
          </div>
          <div className="span-2">
            <PasswordField id="cu-password" label="Temporary password" withGenerator onGenerate={(p) => setForm((f) => ({ ...f, password: p }))} showStrength value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
          </div>
          <div className="span-2">
            <Field label={isAdminRole ? 'Facilities they can manage' : 'Store'} error={errors.stores}>
              {isAdminRole ? (
                <div className="check-list">
                  {stores.map((s) => (
                    <label className="check-item" key={s.id}>
                      <input type="checkbox" checked={form.storeIds.includes(s.id)} onChange={() => toggleStore(s.id)} />
                      {s.name}
                      <small>{s.storeCode}</small>
                    </label>
                  ))}
                </div>
              ) : (
                <select id="cu-store" className="input" value={form.storeId} onChange={set('storeId')}>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.storeCode})</option>)}
                </select>
              )}
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/* -------------------------------- edit user -------------------------------- */

export function EditUserModal({ me, user, stores, onClose, onDone }) {
  const isAdminRole = user.role === 'admin'
  const [userName, setUserName] = useState(user.userName)
  const [storeIds, setStoreIds] = useState(user.storeIds)
  const [serverError, setServerError] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const canMove = me.role === 'owner'

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    if (userName.trim().length < 2) return setError('Enter a name (min 2 characters)')
    if (storeIds.length === 0) return setError('Select a store')
    setError('')

    const body = {}
    if (userName.trim() !== user.userName) body.userName = userName.trim()
    if (canMove && [...storeIds].sort().join() !== [...user.storeIds].sort().join()) body.storeIds = storeIds
    if (Object.keys(body).length === 0) return onClose()

    setLoading(true)
    try {
      await api.patch(`/users/${user.id}`, body)
      onDone('User updated')
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Edit user"
      subtitle={ROLE_LABELS[user.role]}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button id="edit-user-submit" type="submit" form="edit-user-form" variant="primary" loading={loading}>Save changes</Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />
        <TextField id="eu-username" label="Name" value={userName} onChange={(e) => setUserName(e.target.value)} error={error && userName.trim().length < 2 ? error : ''} />
        {canMove && (
          <Field label={isAdminRole ? 'Facilities' : 'Store'} error={error && storeIds.length === 0 ? error : ''}>
            {isAdminRole ? (
              <div className="check-list">
                {stores.map((s) => (
                  <label className="check-item" key={s.id}>
                    <input
                      type="checkbox"
                      checked={storeIds.includes(s.id)}
                      onChange={() => setStoreIds((ids) => (ids.includes(s.id) ? ids.filter((i) => i !== s.id) : [...ids, s.id]))}
                    />
                    {s.name}
                    <small>{s.storeCode}</small>
                  </label>
                ))}
              </div>
            ) : (
              <select id="eu-store" className="input" value={storeIds[0] ?? ''} onChange={(e) => setStoreIds([e.target.value])}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.storeCode})</option>)}
              </select>
            )}
          </Field>
        )}
        {canMove && <p className="muted" style={{ fontSize: '.82rem' }}>Moving a user signs them out of all devices.</p>}
      </form>
    </Modal>
  )
}

/* ------------------------------ reset password ----------------------------- */

export function ResetPasswordModal({ user, stores, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [doneWith, setDoneWith] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    const pw = validatePassword(password)
    if (pw) return setError(pw)
    setError('')
    setLoading(true)
    try {
      await api.post(`/users/${user.id}/reset-password`, { newPassword: password })
      setDoneWith(password)
      onDone()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  if (doneWith) {
    const store = stores.find((s) => user.storeIds.includes(s.id))
    return (
      <Modal title="Password reset" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
        <Credentials user={user} storeCode={store?.storeCode} password={doneWith} />
      </Modal>
    )
  }

  return (
    <Modal
      title="Reset password"
      subtitle={`Set a new temporary password for ${user.userName}. They'll be signed out everywhere and must change it at next sign-in.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button id="reset-submit" type="submit" form="reset-form" variant="primary" loading={loading}>Reset password</Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />
        <PasswordField id="reset-password" label="New temporary password" withGenerator onGenerate={setPassword} showStrength value={password} onChange={(e) => setPassword(e.target.value)} error={error} autoComplete="new-password" />
      </form>
    </Modal>
  )
}

/* -------------------------------- permissions ------------------------------ */

export function PermissionsModal({ user, onClose, onDone }) {
  const [catalog, setCatalog] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([api.get('/users/permissions/catalog'), api.get(`/users/${user.id}`)])
      .then(([cat, detail]) => {
        if (!alive) return
        setCatalog(cat)
        setSelected(new Set(detail.user.effectivePermissions))
      })
      .catch((err) => alive && setLoadError(err))
    return () => {
      alive = false
    }
  }, [user.id])

  const defaults = useMemo(() => catalog?.roleDefaults?.[user.role] ?? [], [catalog, user.role])

  const groups = useMemo(() => {
    const out = {}
    for (const p of catalog?.permissions ?? []) (out[p.key.split(':')[0]] ||= []).push(p)
    return Object.entries(out)
  }, [catalog])

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const save = async () => {
    setServerError(null)
    setLoading(true)
    try {
      // Only the difference from the role's defaults is stored
      const grant = [...selected].filter((k) => !defaults.includes(k))
      const revoke = defaults.filter((k) => !selected.has(k))
      await api.put(`/users/${user.id}/permissions`, { grant, revoke })
      onDone('Feature access updated')
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Feature access"
      subtitle={`${user.userName} · ${ROLE_LABELS[user.role]}. Turn features on or off for this user.`}
      onClose={onClose}
      maxWidth={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button id="permissions-save" variant="primary" loading={loading} disabled={!selected} onClick={save}>Save access</Button>
        </>
      }
    >
      <ErrorAlert error={loadError || serverError} />
      {!catalog && !loadError && (
        <div style={{ display: 'grid', gap: 10 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
        </div>
      )}
      {catalog && selected && (
        <>
          <p className="muted" style={{ fontSize: '.85rem', marginBottom: 16 }}>
            You can only turn on features you have yourself. Greyed-out features are outside your own access.
          </p>
          {groups.map(([module, items]) => (
            <div className="perm-module" key={module}>
              <h4>{MODULE_LABELS[module] ?? module}</h4>
              {items.map((p) => {
                const on = selected.has(p.key)
                const locked = !on && !p.grantable && !defaults.includes(p.key)
                return (
                  <div className={`perm-item${locked ? ' locked' : ''}`} key={p.key}>
                    <div>
                      {p.description}
                      <small>{p.key}</small>
                    </div>
                    <label className="switch">
                      <input type="checkbox" id={`perm-${p.key}`} aria-label={p.description} checked={on} disabled={locked} onChange={() => toggle(p.key)} />
                      <span className="track" />
                    </label>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}

/* ---------------------------- activate/deactivate -------------------------- */

export function ConfirmStatusModal({ user, onClose, onDone }) {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(null)
  const deactivating = user.isActive

  const confirm = async () => {
    setLoading(true)
    setServerError(null)
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive })
      onDone(deactivating ? `${user.userName} deactivated` : `${user.userName} reactivated`)
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={deactivating ? 'Deactivate user?' : 'Reactivate user?'}
      onClose={onClose}
      maxWidth={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button id="confirm-status" variant={deactivating ? 'danger' : 'primary'} loading={loading} onClick={confirm}>
            {deactivating ? 'Deactivate' : 'Reactivate'}
          </Button>
        </>
      }
    >
      <ErrorAlert error={serverError} />
      <p>
        {deactivating
          ? `${user.userName} will be signed out immediately and won't be able to sign in until reactivated.`
          : `${user.userName} will be able to sign in again.`}
      </p>
    </Modal>
  )
}
