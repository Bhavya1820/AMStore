import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { Button, ErrorAlert, OtpInput, PasswordField, TextField } from '../components/ui'
import { IconBuilding, IconCheck, IconMail, IconMapPin, IconPhone, IconStore, IconUser } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../api/client'
import { isEmail, validatePassword } from '../utils/helpers'

const STEPS = ['Verify email', 'Enter OTP', 'Store details']
const RESEND_SECONDS = 60

function Stepper({ step }) {
  return (
    <div className="stepper" aria-label="Registration progress">
      {STEPS.map((label, i) => (
        <div key={label} style={{ display: 'contents' }}>
          <div className={`step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}>
            <span className="dot">{i < step ? <IconCheck size={14} /> : i + 1}</span>
            <span className="label">{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`step-line${i < step ? ' done' : ''}`} />}
        </div>
      ))}
    </div>
  )
}

export default function Register() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [registrationToken, setRegistrationToken] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    ownerName: '', password: '', confirm: '', tenantName: '', storeName: '',
    storeEmail: '', phone: '', address: '', gstIn: '',
  })

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const run = async (fn) => {
    setServerError(null)
    setLoading(true)
    try {
      await fn()
    } catch (err) {
      setServerError(err)
      if (err.code === 'REGISTRATION_TOKEN_INVALID') {
        setRegistrationToken('')
        setOtp('')
        setStep(0)
      }
    } finally {
      setLoading(false)
    }
  }

  const sendOtp = (e) => {
    e?.preventDefault()
    if (!isEmail(email.trim())) return setErrors({ email: 'Enter a valid email address' })
    setErrors({})
    run(async () => {
      await api.post('/auth/register/send-otp', { email: email.trim().toLowerCase() }, { auth: false })
      setCooldown(RESEND_SECONDS)
      setOtp('')
      setStep(1)
      toast.success('OTP sent. Check your inbox.')
    })
  }

  const verifyOtp = (e) => {
    e.preventDefault()
    if (otp.length !== 6) return setErrors({ otp: 'Enter the 6-digit code' })
    setErrors({})
    run(async () => {
      const data = await api.post('/auth/register/verify-otp', { email: email.trim().toLowerCase(), otp }, { auth: false })
      setRegistrationToken(data.registrationToken)
      setStep(2)
    })
  }

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (form.ownerName.trim().length < 2) next.ownerName = 'Enter your name'
    if (form.tenantName.trim().length < 2) next.tenantName = 'Enter your business name'
    if (form.storeName.trim().length < 2) next.storeName = 'Enter your store name'
    const pwError = validatePassword(form.password)
    if (pwError) next.password = pwError
    else if (form.password !== form.confirm) next.confirm = 'Passwords do not match'
    if (form.storeEmail && !isEmail(form.storeEmail.trim())) next.storeEmail = 'Enter a valid email'
    if (form.gstIn && form.gstIn.trim().length !== 15) next.gstIn = 'GSTIN must be 15 characters'
    if (form.phone && form.phone.trim().length < 7) next.phone = 'Enter a valid phone number'
    setErrors(next)
    if (Object.keys(next).length) return

    run(async () => {
      const payload = {
        registrationToken,
        ownerName: form.ownerName.trim(),
        password: form.password,
        tenantName: form.tenantName.trim(),
        storeName: form.storeName.trim(),
      }
      for (const key of ['storeEmail', 'phone', 'address', 'gstIn']) {
        if (form[key].trim()) payload[key] = form[key].trim()
      }
      const data = await register(payload)
      toast.success(`Welcome! Your store code is ${data.store.storeCode}`)
      navigate('/dashboard', { replace: true })
    })
  }

  return (
    <AuthShell wide={step === 2}>
      <Stepper step={step} />
      <ErrorAlert error={serverError} />

      {step === 0 && (
        <form onSubmit={sendOtp} noValidate>
          <h1>Create your account</h1>
          <p className="sub">Start with the email you'll use as the store owner. We'll send a code to verify it.</p>
          <TextField id="register-email" label="Owner email" type="email" autoComplete="email" placeholder="you@yourstore.com" icon={<IconMail size={18} />} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Button id="register-send-otp" type="submit" variant="primary" block loading={loading}>Send verification code</Button>
          <p className="auth-foot">Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={verifyOtp} noValidate>
          <h1>Check your email</h1>
          <p className="sub">We sent a 6-digit code to <strong>{email}</strong>. It expires in 5 minutes.</p>
          <OtpInput value={otp} onChange={setOtp} />
          {errors.otp && <p className="alert alert-error">{errors.otp}</p>}
          <Button id="register-verify-otp" type="submit" variant="primary" block loading={loading}>Verify</Button>
          <p className="auth-foot">
            Didn't get it?{' '}
            <button id="register-resend" type="button" className="link-btn" disabled={cooldown > 0 || loading} onClick={() => sendOtp()}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            {' · '}
            <button type="button" className="link-btn" onClick={() => { setStep(0); setServerError(null) }}>Change email</button>
          </p>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submit} noValidate>
          <h1>Set up your store</h1>
          <p className="sub">Email verified. Tell us about you and your first store.</p>
          <div className="form-grid">
            <div className="span-2">
              <TextField id="register-owner-name" label="Your name" autoComplete="name" icon={<IconUser size={18} />} value={form.ownerName} onChange={set('ownerName')} error={errors.ownerName} />
            </div>
            <PasswordField id="register-password" label="Password" autoComplete="new-password" showStrength value={form.password} onChange={set('password')} error={errors.password} hint="8+ characters with a letter and a number" />
            <PasswordField id="register-confirm" label="Confirm password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
            <TextField id="register-tenant" label="Business name" icon={<IconBuilding size={18} />} value={form.tenantName} onChange={set('tenantName')} error={errors.tenantName} />
            <TextField id="register-store" label="First store name" icon={<IconStore size={18} />} value={form.storeName} onChange={set('storeName')} error={errors.storeName} />
            <TextField id="register-store-email" label="Store email (optional)" type="email" placeholder={email} icon={<IconMail size={18} />} value={form.storeEmail} onChange={set('storeEmail')} error={errors.storeEmail} />
            <TextField id="register-phone" label="Phone (optional)" type="tel" icon={<IconPhone size={18} />} value={form.phone} onChange={set('phone')} error={errors.phone} />
            <div className="span-2">
              <TextField id="register-address" label="Address (optional)" icon={<IconMapPin size={18} />} value={form.address} onChange={set('address')} />
            </div>
            <div className="span-2">
              <TextField id="register-gstin" label="GSTIN (optional)" maxLength={15} style={{ textTransform: 'uppercase' }} value={form.gstIn} onChange={set('gstIn')} error={errors.gstIn} />
            </div>
          </div>
          <Button id="register-submit" type="submit" variant="primary" block loading={loading}>Create account</Button>
        </form>
      )}
    </AuthShell>
  )
}
