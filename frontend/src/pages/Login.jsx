import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { Button, ErrorAlert, PasswordField, TextField } from '../components/ui'
import { IconBuilding, IconMail, IconUser } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import { isEmail } from '../utils/helpers'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('email')
  const [form, setForm] = useState({ email: '', storeCode: '', userName: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = () => {
    const next = {}
    if (mode === 'email') {
      if (!isEmail(form.email.trim())) next.email = 'Enter a valid email address'
    } else {
      if (!form.storeCode.trim()) next.storeCode = 'Enter your store code'
      if (!form.userName.trim()) next.userName = 'Enter your username'
    }
    if (!form.password) next.password = 'Enter your password'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    if (!validate()) return
    setLoading(true)
    try {
      const credentials =
        mode === 'email'
          ? { email: form.email.trim().toLowerCase(), password: form.password }
          : { storeCode: form.storeCode.trim(), userName: form.userName.trim(), password: form.password }
      const data = await login(credentials)
      navigate(data.mustChangePassword ? '/change-password' : location.state?.from || '/dashboard', { replace: true })
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1>Welcome back</h1>
      <p className="sub">Sign in to manage your store.</p>

      <div className="tabs" role="tablist">
        <button id="tab-email" type="button" role="tab" aria-selected={mode === 'email'} className={mode === 'email' ? 'active' : ''} onClick={() => { setMode('email'); setErrors({}); setServerError(null) }}>
          Owner / Admin
        </button>
        <button id="tab-staff" type="button" role="tab" aria-selected={mode === 'staff'} className={mode === 'staff' ? 'active' : ''} onClick={() => { setMode('staff'); setErrors({}); setServerError(null) }}>
          Staff
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />

        {mode === 'email' ? (
          <TextField id="login-email" label="Email" type="email" autoComplete="username" placeholder="you@yourstore.com" icon={<IconMail size={18} />} value={form.email} onChange={set('email')} error={errors.email} />
        ) : (
          <>
            <TextField id="login-store-code" label="Store code" placeholder="STR-1A2B3C4D" autoComplete="organization" icon={<IconBuilding size={18} />} value={form.storeCode} onChange={set('storeCode')} error={errors.storeCode} hint="Ask your owner or admin for the store code." />
            <TextField id="login-username" label="Username" autoComplete="username" icon={<IconUser size={18} />} value={form.userName} onChange={set('userName')} error={errors.userName} />
          </>
        )}

        <PasswordField id="login-password" label="Password" autoComplete="current-password" value={form.password} onChange={set('password')} error={errors.password} />

        <Button id="login-submit" type="submit" variant="primary" block loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="auth-foot">
        New store owner? <Link to="/register" id="link-register">Create your account</Link>
      </p>
    </AuthShell>
  )
}
