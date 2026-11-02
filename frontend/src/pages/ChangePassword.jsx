import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ErrorAlert, PasswordField } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { validatePassword } from '../utils/helpers'

// Used both for the forced first-login change and for voluntary changes from the user menu (all roles)
export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const forced = user.mustChangePassword

  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    const next = {}
    if (!form.current) next.current = forced ? 'Enter the temporary password you were given' : 'Enter your current password'
    const pwError = validatePassword(form.next)
    if (pwError) next.next = pwError
    else if (form.next === form.current) next.next = 'New password must be different from the current one'
    else if (form.next !== form.confirm) next.confirm = 'Passwords do not match'
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    try {
      await changePassword(form.current, form.next)
      toast.success('Password updated. Other devices were signed out.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="card" style={{ padding: 32 }}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: 6 }}>{forced ? 'Choose a new password' : 'Change your password'}</h3>
        <p className="muted" style={{ marginBottom: 22 }}>
          {forced
            ? 'You signed in with a temporary password. Set your own password to continue.'
            : 'You will stay signed in on this device. All other devices will be signed out.'}
        </p>
        {forced && (
          <div className="alert alert-info" role="status">
            For your security you must change your password before using the app.
          </div>
        )}
        <ErrorAlert error={serverError} />
        <form onSubmit={submit} noValidate>
          <PasswordField id="cp-current" label={forced ? 'Temporary password' : 'Current password'} autoComplete="current-password" value={form.current} onChange={set('current')} error={errors.current} />
          <PasswordField id="cp-new" label="New password" autoComplete="new-password" showStrength value={form.next} onChange={set('next')} error={errors.next} hint="8+ characters with a letter and a number" />
          <PasswordField id="cp-confirm" label="Confirm new password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Button id="cp-submit" type="submit" variant="primary" loading={loading}>Update password</Button>
            {forced ? (
              <Button type="button" variant="ghost" onClick={async () => { await logout(); navigate('/login') }}>Sign out</Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
