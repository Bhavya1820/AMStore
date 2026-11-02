import { useEffect, useId, useRef, useState } from 'react'
import { IconCheck, IconCopy, IconEye, IconEyeOff, IconX } from './Icons'
import { generatePassword, passwordStrength } from '../utils/helpers'

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}

export function Button({ loading, children, variant, size, block, className = '', ...props }) {
  const cls = ['btn', variant && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="error" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function TextField({ label, error, hint, icon, id, ...props }) {
  const auto = useId()
  const inputId = id || auto
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId}>
      <div className="input-wrap">
        {icon && <span className="lead">{icon}</span>}
        <input id={inputId} className={`input${error ? ' invalid' : ''}`} {...props} />
      </div>
    </Field>
  )
}

export function PasswordField({ label, error, hint, showStrength, withGenerator, onGenerate, id, value, ...props }) {
  const [visible, setVisible] = useState(false)
  const auto = useId()
  const inputId = id || auto
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId}>
      <div className="input-wrap">
        <input
          id={inputId}
          className={`input${error ? ' invalid' : ''}`}
          type={visible ? 'text' : 'password'}
          value={value}
          style={{ paddingRight: withGenerator ? 84 : 46 }}
          {...props}
        />
        <span className="trail" style={{ display: 'flex' }}>
          {withGenerator && (
            <button
              type="button"
              className="btn-icon"
              title="Generate a strong password"
              onClick={() => {
                onGenerate(generatePassword())
                setVisible(true)
              }}
            >
              ✨
            </button>
          )}
          <button
            type="button"
            className="btn-icon"
            aria-label={visible ? 'Hide password' : 'Show password'}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        </span>
      </div>
      {showStrength && value && (
        <div className="strength" data-level={passwordStrength(value)} aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      )}
    </Field>
  )
}

export function Modal({ title, subtitle, onClose, children, footer, maxWidth }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="btn-icon" aria-label="Close dialog" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function CopyButton({ text, label = 'Copy', id }) {
  const [done, setDone] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <Button
      id={id}
      type="button"
      size="sm"
      variant="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        timer.current = setTimeout(() => setDone(false), 1800)
      }}
    >
      {done ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {done ? 'Copied' : label}
    </Button>
  )
}

export function OtpInput({ value, onChange, length = 6 }) {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const setAt = (i, ch) => {
    const next = digits.slice()
    next[i] = ch
    onChange(next.join(''))
  }

  return (
    <div className="otp-row">
      {digits.map((d, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1)
            setAt(i, ch)
            if (ch && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
            if (!pasted) return
            e.preventDefault()
            onChange(pasted)
            refs.current[Math.min(pasted.length, length - 1)]?.focus()
          }}
        />
      ))}
    </div>
  )
}

// Renders server-side validation errors (zod) as a readable list
export function ErrorAlert({ error }) {
  if (!error) return null
  return (
    <div className="alert alert-error" role="alert">
      <span>
        {error.message}
        {error.errors?.length > 0 && (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {error.errors.map((e, i) => (
              <li key={i}>{e.field ? `${e.field}: ` : ''}{e.message}</li>
            ))}
          </ul>
        )}
      </span>
    </div>
  )
}
