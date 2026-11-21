import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, ErrorAlert, Field, Modal, TextField } from '../components/ui'
import {
  IconBarcode,
  IconBox,
  IconCheck,
  IconLock,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconStore,
  IconTrash,
  IconTruck,
} from '../components/Icons'
import { MEASURING_UNIT_SHORT, formatCurrency, formatDate } from '../utils/helpers'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank Transfer / NEFT' },
]

const getLocalTodayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* --------------------- Async Searchable Party Dropdown -------------------- */

function AsyncPartyDropdown({ storeId, selectedParty, onSelect, error }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [options, setOptions] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!storeId || !open) return
    let alive = true
    setLoading(true)
    setPage(1)
    const params = new URLSearchParams({ storeId, page: '1', limit: '20' })
    if (debouncedQuery) params.set('q', debouncedQuery)

    api
      .get(`/purchase-returns/parties?${params.toString()}`)
      .then((res) => {
        if (!alive) return
        setOptions(res.parties || [])
        setHasMore(Boolean(res.hasMore))
        setTotal(res.total ?? (res.parties?.length || 0))
      })
      .catch(() => {
        if (!alive) return
        setOptions([])
        setHasMore(false)
        setTotal(0)
      })
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [storeId, debouncedQuery, open])

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore || !storeId) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        storeId,
        page: String(nextPage),
        limit: '20',
      })
      if (debouncedQuery) params.set('q', debouncedQuery)
      const res = await api.get(`/purchase-returns/parties?${params.toString()}`)
      setOptions((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        const added = (res.parties || []).filter((p) => !seen.has(p.id))
        return [...prev, ...added]
      })
      setPage(nextPage)
      setHasMore(Boolean(res.hasMore))
      if (res.total !== undefined) setTotal(res.total)
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleScroll = (e) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      loadMore()
    }
  }

  return (
    <Field label="Party / Vendor (Async Search) *" error={error}>
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div
          id="async-return-party-trigger"
          className={`input${error ? ' invalid' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            cursor: 'pointer',
          }}
          onClick={() => setOpen((o) => !o)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <IconTruck size={18} style={{ color: 'var(--rose-500)', flexShrink: 0 }} />
            {selectedParty ? (
              <span>
                <strong>{selectedParty.name}</strong>
                {selectedParty.gstIn ? ` (${selectedParty.gstIn})` : ''}
              </span>
            ) : (
              <span style={{ color: 'var(--ink-500)' }}>Search & select party / vendor...</span>
            )}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-500)' }}>▼</span>
        </div>

        {open && (
          <div
            className="card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 50,
              padding: 10,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div className="input-wrap" style={{ marginBottom: 8 }}>
              <span className="lead">
                <IconSearch size={16} />
              </span>
              <input
                id="async-return-party-search"
                className="input"
                style={{ padding: '8px 10px 8px 34px', fontSize: '0.88rem' }}
                placeholder="Type vendor name, mobile, or GSTIN..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {!loading && options.length > 0 && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--ink-500)',
                  padding: '2px 8px 6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  Loaded {options.length} of {total} parties
                </span>
                {hasMore && <span>Scroll for more ↓</span>}
              </div>
            )}

            <div
              style={{ maxHeight: 240, overflowY: 'auto', display: 'grid', gap: 4 }}
              onScroll={handleScroll}
            >
              {loading && (
                <div className="muted" style={{ padding: 10, fontSize: '0.85rem' }}>
                  Searching parties...
                </div>
              )}
              {!loading && options.length === 0 && (
                <div className="muted" style={{ padding: 10, fontSize: '0.85rem' }}>
                  No matching active parties found.
                </div>
              )}
              {!loading &&
                options.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn-ghost"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: 0,
                    }}
                    onClick={() => {
                      onSelect(p)
                      setOpen(false)
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <small className="muted">
                        {[p.mobileNumber, p.gstIn].filter(Boolean).join(' · ') || 'No GSTIN / Phone'}
                      </small>
                    </div>
                    <span
                      className={`badge ${
                        p.balance > 0.004 ? 'purchase' : p.balance < -0.004 ? 'on' : ''
                      }`}
                      style={{ fontSize: '0.73rem' }}
                    >
                      {formatCurrency(Math.abs(p.balance))}{' '}
                      {p.balance > 0.004 ? 'Cr' : p.balance < -0.004 ? 'Adv' : ''}
                    </span>
                  </button>
                ))}
              {loadingMore && (
                <div className="muted" style={{ padding: 8, textAlign: 'center', fontSize: '0.82rem' }}>
                  Loading more parties...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Field>
  )
}

/* --------------- Async Searchable Purchase Invoice Dropdown --------------- */

function AsyncOriginalInvoiceDropdown({ storeId, partyId, selectedInvoice, onSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [options, setOptions] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!storeId || !open) return
    let alive = true
    setLoading(true)
    setPage(1)
    const params = new URLSearchParams({ storeId, page: '1', limit: '20' })
    if (partyId) params.set('partyId', partyId)
    if (debouncedQuery) params.set('q', debouncedQuery)

    api
      .get(`/purchase-returns/invoices?${params.toString()}`)
      .then((res) => {
        if (!alive) return
        setOptions(res.invoices || [])
        setHasMore(Boolean(res.hasMore))
        setTotal(res.total ?? (res.invoices?.length || 0))
      })
      .catch(() => {
        if (!alive) return
        setOptions([])
        setHasMore(false)
        setTotal(0)
      })
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [storeId, partyId, debouncedQuery, open])

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore || !storeId) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        storeId,
        page: String(nextPage),
        limit: '20',
      })
      if (partyId) params.set('partyId', partyId)
      if (debouncedQuery) params.set('q', debouncedQuery)
      const res = await api.get(`/purchase-returns/invoices?${params.toString()}`)
      setOptions((prev) => {
        const seen = new Set(prev.map((inv) => inv.id))
        const added = (res.invoices || []).filter((inv) => !seen.has(inv.id))
        return [...prev, ...added]
      })
      setPage(nextPage)
      setHasMore(Boolean(res.hasMore))
      if (res.total !== undefined) setTotal(res.total)
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleScroll = (e) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      loadMore()
    }
  }

  return (
    <Field
      label="Against Original Purchase Invoice (optional)"
      hint="Selecting an invoice auto-loads its items and reduces its unpaid balance"
    >
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div
          id="async-return-invoice-trigger"
          className="input"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            cursor: 'pointer',
          }}
          onClick={() => setOpen((o) => !o)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <IconReceipt size={18} style={{ color: 'var(--plum-700)', flexShrink: 0 }} />
            {selectedInvoice ? (
              <span>
                <strong>Invoice #{selectedInvoice.invoiceNumber}</strong> (
                {formatCurrency(selectedInvoice.totalAmount)})
              </span>
            ) : (
              <span style={{ color: 'var(--ink-500)' }}>
                {partyId ? 'Select a purchase invoice from this vendor...' : 'Standalone Return (or select invoice)...'}
              </span>
            )}
          </span>
          {selectedInvoice ? (
            <button
              type="button"
              className="link-btn"
              style={{ fontSize: '0.78rem' }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(null)
              }}
            >
              Unlink
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-500)' }}>▼</span>
          )}
        </div>

        {open && (
          <div
            className="card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 50,
              padding: 10,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div className="input-wrap" style={{ marginBottom: 8 }}>
              <span className="lead">
                <IconSearch size={16} />
              </span>
              <input
                className="input"
                style={{ padding: '8px 10px 8px 34px', fontSize: '0.88rem' }}
                placeholder="Search by invoice number..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {!loading && options.length > 0 && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--ink-500)',
                  padding: '2px 8px 6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  Loaded {options.length} of {total} invoices
                </span>
                {hasMore && <span>Scroll for more ↓</span>}
              </div>
            )}

            <div
              style={{ maxHeight: 230, overflowY: 'auto', display: 'grid', gap: 4 }}
              onScroll={handleScroll}
            >
              <button
                type="button"
                className="btn-ghost"
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 0,
                  fontSize: '0.85rem',
                }}
                onClick={() => {
                  onSelect(null)
                  setOpen(false)
                }}
              >
                — Standalone Return (No Linked Invoice) —
              </button>

              {loading && (
                <div className="muted" style={{ padding: 10, fontSize: '0.85rem' }}>
                  Loading purchase invoices...
                </div>
              )}
              {!loading && options.length === 0 && (
                <div className="muted" style={{ padding: 10, fontSize: '0.85rem' }}>
                  No purchase invoices found{partyId ? ' for this party' : ''}.
                </div>
              )}
              {!loading &&
                options.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    className="btn-ghost"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: 0,
                    }}
                    onClick={() => {
                      onSelect(inv)
                      setOpen(false)
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        Invoice #{inv.invoiceNumber}{' '}
                        {inv.party && !partyId ? `· ${inv.party.name}` : ''}
                      </div>
                      <small className="muted">
                        {formatDate(inv.invoiceDate)} · {inv.items.length}{' '}
                        {inv.items.length === 1 ? 'item' : 'items'}
                      </small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                        {formatCurrency(inv.totalAmount)}
                      </div>
                      {inv.balanceAmount > 0.004 ? (
                        <small style={{ color: 'var(--red-500)', fontSize: '0.73rem' }}>
                          Due: {formatCurrency(inv.balanceAmount)}
                        </small>
                      ) : (
                        <small style={{ color: 'var(--green-500)', fontSize: '0.73rem' }}>Paid</small>
                      )}
                    </div>
                  </button>
                ))}
              {loadingMore && (
                <div className="muted" style={{ padding: 8, textAlign: 'center', fontSize: '0.82rem' }}>
                  Loading more invoices...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Field>
  )
}

/* ---------------- Async Searchable Inventory Item Dropdown ---------------- */

function AsyncItemPicker({ storeId, onPickItem }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [options, setOptions] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!storeId || !open) return
    let alive = true
    setLoading(true)
    setPage(1)
    const params = new URLSearchParams({ storeId, page: '1', limit: '20' })
    if (debouncedQuery) params.set('q', debouncedQuery)

    api
      .get(`/purchase-returns/items?${params.toString()}`)
      .then((res) => {
        if (!alive) return
        setOptions(res.items || [])
        setHasMore(Boolean(res.hasMore))
        setTotal(res.total ?? (res.items?.length || 0))
      })
      .catch(() => {
        if (!alive) return
        setOptions([])
        setHasMore(false)
        setTotal(0)
      })
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [storeId, debouncedQuery, open])

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore || !storeId) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        storeId,
        page: String(nextPage),
        limit: '20',
      })
      if (debouncedQuery) params.set('q', debouncedQuery)
      const res = await api.get(`/purchase-returns/items?${params.toString()}`)
      setOptions((prev) => {
        const seen = new Set(prev.map((it) => it.id))
        const added = (res.items || []).filter((it) => !seen.has(it.id))
        return [...prev, ...added]
      })
      setPage(nextPage)
      setHasMore(Boolean(res.hasMore))
      if (res.total !== undefined) setTotal(res.total)
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleScroll = (e) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      loadMore()
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 280 }}>
      <div className="input-wrap">
        <span className="lead">
          <IconSearch size={18} />
        </span>
        <input
          id="async-return-item-search-input"
          className="input"
          placeholder="Search & add inventory item to return by name, barcode, or HSN..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
        />
      </div>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 50,
            padding: 8,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {!loading && options.length > 0 && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--ink-500)',
                padding: '4px 10px 6px',
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--cream-200)',
                marginBottom: 4,
              }}
            >
              <span>
                Loaded {options.length} of {total} items
              </span>
              {hasMore && <span>Scroll for more ↓</span>}
            </div>
          )}

          <div
            style={{ maxHeight: 270, overflowY: 'auto', display: 'grid', gap: 2 }}
            onScroll={handleScroll}
          >
            {loading && (
              <div className="muted" style={{ padding: 10, fontSize: '0.85rem' }}>
                Searching inventory items...
              </div>
            )}
            {!loading && options.length === 0 && (
              <div className="muted" style={{ padding: 10, fontSize: '0.85rem' }}>
                No matching inventory items found.
              </div>
            )}
            {!loading &&
              options.map((it) => {
                const u = MEASURING_UNIT_SHORT[it.measuringUnit] || it.measuringUnit
                return (
                  <button
                    key={it.id}
                    type="button"
                    className="btn-ghost"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 0,
                    }}
                    onClick={() => {
                      onPickItem(it)
                      setQuery('')
                      setOpen(false)
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{it.name}</div>
                      <small className="muted">
                        Barcode: <span style={{ fontFamily: 'monospace' }}>{it.barcode}</span> · HSN:{' '}
                        {it.hsn} · GST: {it.gst}%
                      </small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {formatCurrency(it.purchasePrice)}/{u}
                      </div>
                      <span className="badge on" style={{ fontSize: '0.72rem' }}>
                        Stock: {it.currentStock} {u}
                      </span>
                    </div>
                  </button>
                )
              })}
            {loadingMore && (
              <div className="muted" style={{ padding: 8, textAlign: 'center', fontSize: '0.82rem' }}>
                Loading more items...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------- Barcode Scanner Modal -------------------------- */

function BarcodeScannerModal({ storeId, onScannedItem, onClose }) {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scanningCamera, setScanningCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentScans, setRecentScans] = useState([])

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const inputRef = useRef(null)

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setScanningCamera(false)
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const lookupBarcode = async (code) => {
    const trimmed = String(code || '').trim()
    if (!trimmed) return
    setLookupError('')
    setLoading(true)
    try {
      const res = await api.get(
        `/purchase-returns/items/barcode/${encodeURIComponent(trimmed)}?storeId=${storeId}`
      )
      onScannedItem(res.item)
      setRecentScans((prev) => [
        { ...res.item, scannedAt: new Date().toLocaleTimeString() },
        ...prev.slice(0, 7),
      ])
      setBarcodeInput('')
      inputRef.current?.focus()
    } catch (err) {
      setLookupError(err.message || `No item found with barcode "${trimmed}"`)
    } finally {
      setLoading(false)
    }
  }

  const startCameraScan = async () => {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this browser. Use the USB scanner / manual box below.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setScanningCamera(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
        })
        let lastCode = ''
        let lastTime = 0
        const detectLoop = async () => {
          if (!videoRef.current || !streamRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const raw = barcodes[0].rawValue
              const now = Date.now()
              if (raw && (raw !== lastCode || now - lastTime > 2000)) {
                lastCode = raw
                lastTime = now
                lookupBarcode(raw)
              }
            }
          } catch {
            // continue scanning
          }
          rafRef.current = requestAnimationFrame(detectLoop)
        }
        rafRef.current = requestAnimationFrame(detectLoop)
      } else {
        setCameraError(
          'Live camera preview is active, but native BarcodeDetector is not enabled in this browser. Use a USB barcode gun or enter the barcode below.'
        )
      }
    } catch {
      setCameraError('Could not access camera. Check camera permissions or use a USB barcode scanner gun below.')
    }
  }

  return (
    <Modal
      title="Scan Item Barcode for Purchase Return"
      subtitle="Scan or enter the barcode of the item being returned to the vendor."
      onClose={() => {
        stopCamera()
        onClose()
      }}
      maxWidth={580}
      footer={
        <Button
          variant="primary"
          onClick={() => {
            stopCamera()
            onClose()
          }}
        >
          Done Scanning
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          lookupBarcode(barcodeInput)
        }}
        style={{ marginBottom: 16 }}
      >
        <Field
          label="Barcode Scanner Input (USB Gun or Manual Entry)"
          hint="Point your barcode scanner gun and scan — it will automatically submit on Enter."
          error={lookupError}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="input-wrap" style={{ flex: 1 }}>
              <span className="lead">
                <IconBarcode size={18} />
              </span>
              <input
                ref={inputRef}
                id="modal-return-barcode-input"
                className="input"
                placeholder="Scan or type barcode (e.g. 890123450001) & press Enter..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" variant="primary" loading={loading}>
              Add Item
            </Button>
          </div>
        </Field>
      </form>

      <div
        className="card"
        style={{
          padding: 14,
          background: 'var(--cream-50)',
          marginBottom: 16,
          textAlign: 'center',
        }}
      >
        {!scanningCamera ? (
          <Button type="button" variant="ghost" size="sm" onClick={startCameraScan}>
            <IconBarcode size={16} /> Start Camera Barcode Scanner
          </Button>
        ) : (
          <div>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxHeight: 220,
                borderRadius: 12,
                background: '#000',
                objectFit: 'cover',
              }}
              muted
              playsInline
            />
            <div style={{ marginTop: 8 }}>
              <Button type="button" variant="ghost" size="sm" onClick={stopCamera}>
                Stop Camera
              </Button>
            </div>
          </div>
        )}
        {cameraError && (
          <p className="muted" style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--amber-500)' }}>
            {cameraError}
          </p>
        )}
      </div>

      {recentScans.length > 0 && (
        <div>
          <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: 8 }}>
            Scanned & Added to Return ({recentScans.length}):
          </strong>
          <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {recentScans.map((it, i) => (
              <div
                key={`${it.id}-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: '#e6f7f0',
                  border: '1px solid #b9e8d6',
                  fontSize: '0.86rem',
                }}
              >
                <span>
                  <IconCheck size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--green-500)' }} />
                  <strong>{it.name}</strong> ({it.barcode})
                </span>
                <span className="muted">{it.scannedAt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------ Main Create Purchase Return Page ---------------------- */

export default function CreatePurchaseReturn() {
  const { user, has } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const todayStr = getLocalTodayStr()
  const canEditPricing =
    user?.role === 'owner' || user?.role === 'admin' || has('purchase:edit_pricing')

  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState(searchParams.get('storeId') || '')

  const [selectedParty, setSelectedParty] = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [purchaseReturnNumber, setPurchaseReturnNumber] = useState('')
  const [purchaseReturnDate, setPurchaseReturnDate] = useState(todayStr)
  const [notes, setNotes] = useState('')

  // Return item lines
  const [lines, setLines] = useState([])

  // Quick inline barcode scan box
  const [quickBarcode, setQuickBarcode] = useState('')
  const [scanningQuick, setScanningQuick] = useState(false)
  const [scannerModalOpen, setScannerModalOpen] = useState(false)

  // Settlement / Refund state
  // 'adjust_balance': reduce payable balance owed to party (amountReceived = 0)
  // 'full_refund': vendor refunded full return amount in cash/bank
  // 'partial_refund': vendor refunded partial amount, rest adjusts balance
  const [refundMode, setRefundMode] = useState('adjust_balance')
  const [refundMethod, setRefundMethod] = useState('cash')
  const [partialRefund, setPartialRefund] = useState('')

  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .get('/stores')
      .then((res) => {
        if (!alive) return
        setStores(res.stores)
        if (res.stores.length > 0) {
          setSelectedStoreId((prev) => prev || res.stores[0].id)
        }
      })
      .catch((err) => alive && setServerError(err))
    return () => {
      alive = false
    }
  }, [])

  const currentStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId),
    [stores, selectedStoreId]
  )

  // When an original purchase invoice is selected, auto-populate party & its purchased items
  const handleSelectOriginalInvoice = (inv) => {
    setSelectedInvoice(inv)
    if (!inv) return

    if (inv.party && (!selectedParty || selectedParty.id !== inv.party.id)) {
      setSelectedParty({
        id: inv.party.id,
        name: inv.party.name,
        mobileNumber: inv.party.mobileNumber,
        gstIn: inv.party.gstIn,
        balance: 0,
      })
    }

    if (!purchaseReturnNumber.trim()) {
      setPurchaseReturnNumber(`PR-${inv.invoiceNumber}`)
    }

    const mappedLines = (inv.items || []).map((it) => ({
      item: {
        id: it.itemId,
        name: it.name,
        barcode: it.barcode,
        hsn: it.hsn,
        measuringUnit: it.measuringUnit,
        purchasePrice: it.rate,
        purchasePriceWithTax: it.priceIncludesTax,
        gst: it.gst,
        currentStock: null,
      },
      maxPurchasedQty: it.quantity,
      quantity: it.quantity,
      rate: it.rate ?? 0,
      priceIncludesTax: Boolean(it.priceIncludesTax),
      discount: it.discount ?? 0,
      gst: it.gst ?? 5,
    }))
    setLines(mappedLines)
    toast.success(`Loaded ${mappedLines.length} item(s) from Invoice #${inv.invoiceNumber}`)
  }

  // Add or increment an inventory item in the return lines
  const addItemToReturn = (item) => {
    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.item.id === item.id)
      if (existingIdx !== -1) {
        return prev.map((l, idx) =>
          idx === existingIdx
            ? { ...l, quantity: Number((Number(l.quantity) + 1).toFixed(4)) }
            : l
        )
      }
      return [
        ...prev,
        {
          item,
          maxPurchasedQty: null,
          quantity: 1,
          rate: item.purchasePrice ?? 0,
          priceIncludesTax: Boolean(item.purchasePriceWithTax),
          discount: 0,
          gst: item.gst ?? 5,
        },
      ]
    })
  }

  const handleQuickBarcodeSubmit = async (e) => {
    e.preventDefault()
    const code = quickBarcode.trim()
    if (!code || !selectedStoreId) return
    setScanningQuick(true)
    setServerError(null)
    try {
      const res = await api.get(
        `/purchase-returns/items/barcode/${encodeURIComponent(code)}?storeId=${selectedStoreId}`
      )
      addItemToReturn(res.item)
      toast.success(`Added "${res.item.name}" to purchase return`)
      setQuickBarcode('')
    } catch (err) {
      toast.error(err.message || `No item found with barcode "${code}"`)
    } finally {
      setScanningQuick(false)
    }
  }

  const updateLine = (idx, field, val) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)))
  }

  const removeLine = (idx) => {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  // Compute live line totals and return summary
  const computed = useMemo(() => {
    let totalTaxable = 0
    let totalDiscount = 0
    let totalGst = 0
    let grandTotal = 0

    const lineSummaries = lines.map((l) => {
      const qty = Math.max(0, Number(l.quantity) || 0)
      const rate = Math.max(0, Number(l.rate) || 0)
      const discount = Math.max(0, Number(l.discount) || 0)
      const gstRate = Math.max(0, Number(l.gst) || 0)
      const gross = Math.max(0, Math.round((qty * rate - discount) * 100) / 100)

      let taxable = gross
      let gstAmt = 0
      let total = gross

      if (l.priceIncludesTax && gstRate > 0) {
        taxable = Math.round((gross / (1 + gstRate / 100)) * 100) / 100
        gstAmt = Math.round((gross - taxable) * 100) / 100
        total = gross
      } else {
        taxable = gross
        gstAmt = Math.round(((gross * gstRate) / 100) * 100) / 100
        total = Math.round((taxable + gstAmt) * 100) / 100
      }

      totalTaxable = Math.round((totalTaxable + taxable) * 100) / 100
      totalDiscount = Math.round((totalDiscount + discount) * 100) / 100
      totalGst = Math.round((totalGst + gstAmt) * 100) / 100
      grandTotal = Math.round((grandTotal + total) * 100) / 100

      return { taxable, gstAmt, total }
    })

    const amountReceived =
      refundMode === 'full_refund'
        ? grandTotal
        : refundMode === 'partial_refund'
        ? Math.min(grandTotal, Math.max(0, Number(partialRefund) || 0))
        : 0

    const balanceAdjusted = Math.max(0, Math.round((grandTotal - amountReceived) * 100) / 100)

    return {
      lineSummaries,
      totalTaxable,
      totalDiscount,
      totalGst,
      grandTotal,
      amountReceived,
      balanceAdjusted,
    }
  }, [lines, refundMode, partialRefund])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError(null)

    const nextErrors = {}
    if (!selectedParty) nextErrors.party = 'Please select a party / vendor'
    if (!purchaseReturnNumber.trim()) {
      nextErrors.purchaseReturnNumber = 'Return / Debit Note number is required'
    }
    if (!purchaseReturnDate) {
      nextErrors.purchaseReturnDate = 'Return date is required'
    } else if (purchaseReturnDate > todayStr) {
      nextErrors.purchaseReturnDate = 'Future dates are not allowed for purchase returns'
    }
    if (lines.length === 0) {
      nextErrors.items = 'Add at least one item to return'
    }
    for (const l of lines) {
      if (!Number(l.quantity) || Number(l.quantity) <= 0) {
        nextErrors.items = `Return quantity for "${l.item.name}" must be greater than 0`
        break
      }
      if (l.maxPurchasedQty && Number(l.quantity) > l.maxPurchasedQty + 0.0001) {
        nextErrors.items = `Return quantity for "${l.item.name}" cannot exceed purchased quantity (${l.maxPurchasedQty})`
        break
      }
      if (Number(l.rate) < 0) {
        nextErrors.items = `Rate for "${l.item.name}" cannot be negative`
        break
      }
    }
    if (
      refundMode === 'partial_refund' &&
      (!Number(partialRefund) || Number(partialRefund) <= 0)
    ) {
      nextErrors.payment = 'Enter a valid partial refund amount received'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const payments =
        computed.amountReceived > 0
          ? [{ amount: computed.amountReceived, method: refundMethod }]
          : []

      const payload = {
        partyId: selectedParty.id,
        ...(selectedInvoice ? { invoiceId: selectedInvoice.id } : {}),
        purchaseReturnNumber: purchaseReturnNumber.trim(),
        purchaseReturnDate,
        items: lines.map((l) => ({
          itemId: l.item.id,
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          priceIncludesTax: Boolean(l.priceIncludesTax),
          discount: Number(l.discount) || 0,
          gst: Number(l.gst) || 0,
        })),
        payments,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }

      const res = await api.post(
        `/purchase-returns?storeId=${selectedStoreId}`,
        payload
      )
      toast.success(
        `Purchase Return #${res.purchaseReturn.purchaseReturnNumber} recorded — stock reversed & party balance adjusted!`
      )
      navigate(`/purchase-returns?storeId=${selectedStoreId}`)
    } catch (err) {
      setServerError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Top Toolbar */}
      <div
        className="toolbar"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            Create Purchase Return (Debit Note)
          </h2>
          <p className="muted">
            Return damaged or excess items to a vendor. Inventory stock will be reversed (−) and the party balance will be reduced automatically.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {stores.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconStore size={18} style={{ color: 'var(--rose-500)' }} />
              <select
                className="input"
                style={{ width: 'auto', minWidth: 210, fontWeight: 600 }}
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value)
                  setSelectedParty(null)
                  setSelectedInvoice(null)
                  setLines([])
                }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.storeCode})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            currentStore && (
              <span className="badge" style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
                <IconStore size={15} /> {currentStore.name} ({currentStore.storeCode})
              </span>
            )
          )}

          <Button
            variant="ghost"
            onClick={() => navigate(`/purchase-returns?storeId=${selectedStoreId}`)}
          >
            ← Back to Purchase Returns
          </Button>
        </div>
      </div>

      <ErrorAlert error={serverError} />

      {/* Step 1: Party, Linked Invoice & Return Header */}
      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 16,
          }}
        >
          <AsyncPartyDropdown
            storeId={selectedStoreId}
            selectedParty={selectedParty}
            onSelect={(p) => {
              setSelectedParty(p)
              if (selectedInvoice && selectedInvoice.party?.id !== p?.id) {
                setSelectedInvoice(null)
              }
              setErrors((err) => ({ ...err, party: '' }))
            }}
            error={errors.party}
          />

          <AsyncOriginalInvoiceDropdown
            storeId={selectedStoreId}
            partyId={selectedParty?.id}
            selectedInvoice={selectedInvoice}
            onSelect={handleSelectOriginalInvoice}
          />

          <TextField
            id="purchase-return-number"
            label="Purchase Return / Debit Note # *"
            placeholder="e.g. PR-2026-001"
            icon={<IconRefresh size={18} />}
            value={purchaseReturnNumber}
            onChange={(e) => {
              setPurchaseReturnNumber(e.target.value)
              setErrors((err) => ({ ...err, purchaseReturnNumber: '' }))
            }}
            error={errors.purchaseReturnNumber}
          />

          <TextField
            id="purchase-return-date"
            label="Return Date *"
            type="date"
            max={todayStr}
            hint="Future dates are blocked"
            value={purchaseReturnDate}
            onChange={(e) => {
              const val = e.target.value
              setPurchaseReturnDate(val > todayStr ? todayStr : val)
              setErrors((err) => ({ ...err, purchaseReturnDate: '' }))
            }}
            error={errors.purchaseReturnDate}
          />
        </div>
      </div>

      {/* Step 2: Inventory Item Search & Barcode Scanner Bar */}
      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              Items Being Returned (Stock Reversal)
            </h3>
            <p className="muted" style={{ fontSize: '0.84rem' }}>
              Search inventory items asynchronously, select an original purchase invoice above, or scan barcodes.
            </p>
          </div>
          {!canEditPricing && (
            <span
              className="badge"
              style={{
                background: 'var(--cream-100)',
                color: 'var(--ink-700)',
                border: '1px solid var(--cream-200)',
                fontSize: '0.78rem',
              }}
            >
              <IconLock size={13} /> Return Price, GST % & Incl. GST are read-only (ask Admin for access)
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          {/* Async Inventory Item Dropdown */}
          <AsyncItemPicker
            storeId={selectedStoreId}
            onPickItem={(item) => {
              addItemToReturn(item)
              setErrors((err) => ({ ...err, items: '' }))
            }}
          />

          {/* Quick Inline Barcode Scan Form */}
          <form
            onSubmit={handleQuickBarcodeSubmit}
            style={{ display: 'flex', gap: 8, minWidth: 260 }}
          >
            <div className="input-wrap" style={{ flex: 1 }}>
              <span className="lead">
                <IconBarcode size={18} />
              </span>
              <input
                id="quick-return-barcode-input"
                className="input"
                placeholder="Quick scan barcode & Enter..."
                value={quickBarcode}
                onChange={(e) => setQuickBarcode(e.target.value)}
              />
            </div>
            <Button type="submit" variant="ghost" loading={scanningQuick}>
              Add
            </Button>
          </form>

          {/* Dedicated Camera / USB Barcode Scanner Modal Trigger */}
          <Button
            id="open-return-barcode-scanner-btn"
            type="button"
            variant="primary"
            onClick={() => setScannerModalOpen(true)}
          >
            <IconBarcode size={17} /> Scan Barcode
          </Button>
        </div>

        {errors.items && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            {errors.items}
          </div>
        )}

        {/* Return Items Table */}
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th>#</th>
                <th style={{ minWidth: 210 }}>Item & Current Stock</th>
                <th style={{ width: 130 }}>Return Qty (−) *</th>
                <th style={{ width: 150 }}>
                  Return Rate (₹) {!canEditPricing && <IconLock size={13} />}
                </th>
                <th style={{ width: 110 }}>
                  Incl. GST {!canEditPricing && <IconLock size={13} />}
                </th>
                <th style={{ width: 120 }}>Discount (₹)</th>
                <th style={{ width: 110 }}>
                  GST % {!canEditPricing && <IconLock size={13} />}
                </th>
                <th style={{ textAlign: 'right' }}>Taxable</th>
                <th style={{ textAlign: 'right' }}>Line Total</th>
                <th style={{ width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty" style={{ padding: '32px 16px' }}>
                      <IconBox size={26} style={{ color: 'var(--ink-400)', marginBottom: 8 }} />
                      <div>
                        No items added yet. Select an original invoice above, search an item, or click{' '}
                        <strong>Scan Barcode</strong>.
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {lines.map((line, idx) => {
                const u =
                  MEASURING_UNIT_SHORT[line.item.measuringUnit] || line.item.measuringUnit
                const sum = computed.lineSummaries[idx] || {
                  taxable: 0,
                  gstAmt: 0,
                  total: 0,
                }
                const afterStock =
                  line.item.currentStock !== null && line.item.currentStock !== undefined
                    ? Number((Number(line.item.currentStock) - (Number(line.quantity) || 0)).toFixed(4))
                    : null

                return (
                  <tr key={line.item.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong>{line.item.name}</strong>
                      <small className="muted" style={{ display: 'block' }}>
                        {line.item.barcode ? `Barcode: ${line.item.barcode} · ` : ''}
                        {line.item.currentStock !== null && line.item.currentStock !== undefined && (
                          <>
                            Stock: {line.item.currentStock} {u} →{' '}
                            <strong style={{ color: 'var(--red-500)' }}>
                              After: {afterStock} {u}
                            </strong>
                          </>
                        )}
                        {line.maxPurchasedQty && (
                          <span className="badge owner" style={{ marginLeft: 6, fontSize: '0.68rem' }}>
                            Purchased: {line.maxPurchasedQty} {u}
                          </span>
                        )}
                      </small>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          className="input"
                          style={{ padding: '7px 10px' }}
                          min="0.01"
                          max={line.maxPurchasedQty || undefined}
                          step="any"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                        />
                        <span className="muted" style={{ fontSize: '0.8rem' }}>
                          {u}
                        </span>
                      </div>
                    </td>

                    <td>
                      <input
                        type="number"
                        className="input"
                        style={{
                          padding: '7px 10px',
                          background: !canEditPricing ? 'var(--cream-100)' : undefined,
                          cursor: !canEditPricing ? 'not-allowed' : undefined,
                        }}
                        min="0"
                        step="0.01"
                        value={line.rate}
                        disabled={!canEditPricing}
                        readOnly={!canEditPricing}
                        onChange={(e) =>
                          canEditPricing && updateLine(idx, 'rate', e.target.value)
                        }
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={line.priceIncludesTax}
                        disabled={!canEditPricing}
                        style={{ cursor: !canEditPricing ? 'not-allowed' : 'pointer' }}
                        onChange={(e) =>
                          canEditPricing &&
                          updateLine(idx, 'priceIncludesTax', e.target.checked)
                        }
                        aria-label="Rate includes GST"
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        className="input"
                        style={{ padding: '7px 10px' }}
                        min="0"
                        step="0.01"
                        value={line.discount}
                        onChange={(e) => updateLine(idx, 'discount', e.target.value)}
                      />
                    </td>

                    <td>
                      <select
                        className="input"
                        style={{
                          padding: '7px 10px',
                          background: !canEditPricing ? 'var(--cream-100)' : undefined,
                          cursor: !canEditPricing ? 'not-allowed' : undefined,
                        }}
                        value={line.gst}
                        disabled={!canEditPricing}
                        onChange={(e) =>
                          canEditPricing && updateLine(idx, 'gst', Number(e.target.value))
                        }
                      >
                        {[0, 5, 12, 18, 28].map((g) => (
                          <option key={g} value={g}>
                            {g}%
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {formatCurrency(sum.taxable)}
                      <small className="muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                        +GST {formatCurrency(sum.gstAmt)}
                      </small>
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {formatCurrency(sum.total)}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        title="Remove item"
                        onClick={() => removeLine(idx)}
                      >
                        <IconTrash size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 3: Party Balance Adjustment / Refund & Summary */}
      <form onSubmit={handleSubmit} noValidate>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 18,
            alignItems: 'start',
          }}
        >
          {/* Left: Balance Adjustment / Refund Mode & Notes */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 12 }}>
              Party Balance Adjustment & Refund
            </h3>

            <Field label="Settlement Status">
              <div className="tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={refundMode === 'adjust_balance'}
                  className={refundMode === 'adjust_balance' ? 'active' : ''}
                  onClick={() => setRefundMode('adjust_balance')}
                >
                  Adjust Party Balance
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={refundMode === 'full_refund'}
                  className={refundMode === 'full_refund' ? 'active' : ''}
                  onClick={() => setRefundMode('full_refund')}
                >
                  Full Refund Received
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={refundMode === 'partial_refund'}
                  className={refundMode === 'partial_refund' ? 'active' : ''}
                  onClick={() => setRefundMode('partial_refund')}
                >
                  Partial Refund
                </button>
              </div>
            </Field>

            {refundMode !== 'adjust_balance' && (
              <div className="form-grid" style={{ marginTop: 12 }}>
                <Field label="Refund Payment Mode">
                  <select
                    className="input"
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {refundMode === 'partial_refund' ? (
                  <TextField
                    id="return-partial-refund-amount"
                    label="Amount Refunded by Vendor (₹) *"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={partialRefund}
                    onChange={(e) => setPartialRefund(e.target.value)}
                    error={errors.payment}
                  />
                ) : (
                  <Field label="Amount Refunded by Vendor">
                    <div
                      className="input"
                      style={{
                        background: 'var(--cream-50)',
                        fontWeight: 700,
                        color: 'var(--green-500)',
                      }}
                    >
                      {formatCurrency(computed.grandTotal)}
                    </div>
                  </Field>
                )}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <TextField
                id="purchase-return-notes"
                label="Return Reason / Remarks (optional)"
                placeholder="e.g. Damaged boxes / Expired batch returned to vendor"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Right: Return Totals Card & Submit */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14 }}>
              Purchase Return Summary
            </h3>

            <div style={{ display: 'grid', gap: 10, fontSize: '0.92rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Taxable Return Value</span>
                <strong>{formatCurrency(computed.totalTaxable)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Total Line Discount</span>
                <strong>− {formatCurrency(computed.totalDiscount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Total GST Reversed (CGST + SGST)</span>
                <strong>+ {formatCurrency(computed.totalGst)}</strong>
              </div>
              <hr style={{ border: 0, borderTop: '1px solid var(--cream-200)', margin: '4px 0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                }}
              >
                <span>Total Return Value</span>
                <span style={{ color: 'var(--plum-800)' }}>
                  {formatCurrency(computed.grandTotal)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--green-500)',
                }}
              >
                <span>Party Payable Balance Reduced</span>
                <strong>− {formatCurrency(computed.balanceAdjusted)}</strong>
              </div>
              {computed.amountReceived > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: 'var(--ink-700)',
                  }}
                >
                  <span>Cash / Bank Refund Received</span>
                  <strong>{formatCurrency(computed.amountReceived)}</strong>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 20,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(`/purchase-returns?storeId=${selectedStoreId}`)}
              >
                Cancel
              </Button>
              <Button
                id="submit-purchase-return-btn"
                type="submit"
                variant="primary"
                loading={submitting}
              >
                <IconCheck size={17} /> Save Purchase Return
              </Button>
            </div>
          </div>
        </div>
      </form>

      {scannerModalOpen && (
        <BarcodeScannerModal
          storeId={selectedStoreId}
          onScannedItem={(item) => {
            addItemToReturn(item)
            toast.success(`Scanned "${item.name}"`)
          }}
          onClose={() => setScannerModalOpen(false)}
        />
      )}
    </>
  )
}
