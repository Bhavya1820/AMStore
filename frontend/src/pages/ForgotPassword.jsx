import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { Button, ErrorAlert, OtpInput, PasswordField, TextField } from '../components/ui'
import { IconBuilding, IconCheck, IconMail, IconUser } from '../components/Icons'
import { useToast } from '../context/ToastContext'
import { api } from '../api/client'
import { isEmail, validatePassword } from '../utils/helpers'

const STEPS = ['Find account', 'Verify OTP', 'New password']
const RESEND_SECONDS = 60

function Stepper({ step }) {
  return (
    <div className="stepper" aria-label="Password reset progress">
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

export default function ForgotPassword() {
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [mode, setMode] = useState('email') // 'email' | 'staff'
  const [lookup, setLookup] = useState({ email: '', storeCode: '', userName: '' })
  const [maskedEmail, setMaskedEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [passwords, setPasswords] = useState({ newPassword: '', confirm: '' })
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const buildLookupPayload = () =>
    mode === 'email'
      ? { email: lookup.email.trim().toLowerCase() }
      : { storeCode: lookup.storeCode.trim().toUpperCase(), userName: lookup.userName.trim() }

  const run = async (fn) => {
    setServerError(null)
    setLoading(true)
    try {
      await fn()
    } catch (err) {
      setServerError(err)
      if (err.code === 'RESET_TOKEN_INVALID') {
        setResetToken('')
        setOtp('')
        setStep(0)
      }
    } finally {
      setLoading(false)
    }
  }

  const sendOtp = (e) => {
    e?.preventDefault()
    const next = {}
    if (mode === 'email') {
      if (!isEmail(lookup.email.trim())) next.email = 'Enter a valid email address'
    } else {
      if (!lookup.storeCode.trim()) next.storeCode = 'Enter your store code'
      if (!lookup.userName.trim()) next.userName = 'Enter your username'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    run(async () => {
      const res = await api.post('/auth/forgot-password/send-otp', buildLookupPayload(), { auth: false })
      setMaskedEmail(res.maskedEmail || lookup.email.trim())
      setCooldown(RESEND_SECONDS)
      setOtp('')
      setStep(1)
      toast.success(`Verification code sent to ${res.maskedEmail}`)
    })
  }

  const verifyOtp = (e) => {
    e.preventDefault()
    if (otp.length !== 6) return setErrors({ otp: 'Enter the 6-digit verification code' })
    setErrors({})

    run(async () => {
      const res = await api.post(
        '/auth/forgot-password/verify-otp',
        { ...buildLookupPayload(), otp },
        { auth: false }
      )
      setResetToken(res.resetToken)
      setStep(2)
    })
  }

  const submitNewPassword = (e) => {
    e.preventDefault()
    const next = {}
    const pwErr = validatePassword(passwords.newPassword)
    if (pwErr) next.newPassword = pwErr
    else if (passwords.newPassword !== passwords.confirm) next.confirm = 'Passwords do not match'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    run(async () => {
      await api.post(
        '/auth/forgot-password/reset',
        { resetToken, newPassword: passwords.newPassword },
        { auth: false }
      )
      toast.success('Password reset successfully! Sign in with your new password.')
      navigate('/login', { replace: true })
    })
  }

  return (
    <AuthShell>
      <Stepper step={step} />
      <ErrorAlert error={serverError} />

      {step === 0 && (
        <form onSubmit={sendOtp} noValidate>
          <h1>Forgot password?</h1>
          <p className="sub">
            Select how you sign in and we'll send a 6-digit verification code to reset your password.
          </p>

          <div className="tabs" role="tablist">
            <button
              id="fp-tab-email"
              type="button"
              role="tab"
              aria-selected={mode === 'email'}
              className={mode === 'email' ? 'active' : ''}
              onClick={() => {
                setMode('email')
                setErrors({})
                setServerError(null)
              }}
            >
              Owner / Admin
            </button>
            <button
              id="fp-tab-staff"
              type="button"
              role="tab"
              aria-selected={mode === 'staff'}
              className={mode === 'staff' ? 'active' : ''}
              onClick={() => {
                setMode('staff')
                setErrors({})
                setServerError(null)
              }}
            >
              Staff
            </button>
          </div>

          {mode === 'email' ? (
            <TextField
              id="fp-email"
              label="Account Email"
              type="email"
              autoComplete="email"
              placeholder="you@yourstore.com"
              icon={<IconMail size={18} />}
              value={lookup.email}
              onChange={(e) => setLookup((l) => ({ ...l, email: e.target.value }))}
              error={errors.email}
            />
          ) : (
            <>
              <TextField
                id="fp-store-code"
                label="Store code"
                placeholder="STR-1A2B3C4D"
                icon={<IconBuilding size={18} />}
                value={lookup.storeCode}
                onChange={(e) => setLookup((l) => ({ ...l, storeCode: e.target.value }))}
                error={errors.storeCode}
              />
              <TextField
                id="fp-username"
                label="Username"
                icon={<IconUser size={18} />}
                value={lookup.userName}
                onChange={(e) => setLookup((l) => ({ ...l, userName: e.target.value }))}
                error={errors.userName}
                hint="We'll send the OTP to your linked email or store email."
              />
            </>
          )}

          <Button id="fp-send-otp" type="submit" variant="primary" block loading={loading}>
            Send reset code
          </Button>

          <p className="auth-foot">
            Remembered your password? <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={verifyOtp} noValidate>
          <h1>Enter verification code</h1>
          <p className="sub">
            We sent a 6-digit code to <strong>{maskedEmail}</strong>. It expires in 5 minutes.
          </p>

          <OtpInput value={otp} onChange={setOtp} />
          {errors.otp && <p className="alert alert-error">{errors.otp}</p>}

          <Button id="fp-verify-otp" type="submit" variant="primary" block loading={loading}>
            Verify code
          </Button>

          <p className="auth-foot">
            Didn't receive it?{' '}
            <button
              id="fp-resend"
              type="button"
              className="link-btn"
              disabled={cooldown > 0 || loading}
              onClick={() => sendOtp()}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            {' · '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setStep(0)
                setServerError(null)
              }}
            >
              Change account
            </button>
          </p>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitNewPassword} noValidate>
          <h1>Choose a new password</h1>
          <p className="sub">
            Create a strong password for your account. All other active devices will be signed out.
          </p>

          <PasswordField
            id="fp-new-password"
            label="New password"
            autoComplete="new-password"
            withGenerator
            onGenerate={(p) => setPasswords({ newPassword: p, confirm: p })}
            showStrength
            value={passwords.newPassword}
            onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
            error={errors.newPassword}
            hint="8+ characters with a letter and a number"
          />

          <PasswordField
            id="fp-confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            value={passwords.confirm}
            onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
            error={errors.confirm}
          />

          <Button id="fp-submit" type="submit" variant="primary" block loading={loading}>
            Reset password
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

