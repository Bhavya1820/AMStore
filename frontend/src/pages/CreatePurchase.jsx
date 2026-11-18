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
  IconPlus,
  IconReceipt,
  IconSearch,
  IconStore,
  IconTrash,
  IconTruck,
} from '../components/Icons'
import { MEASURING_UNIT_SHORT, formatCurrency } from '../utils/helpers'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank Transfer / NEFT' },
]

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

  // Fetch page 1 whenever storeId, open, or debouncedQuery changes
  useEffect(() => {
    if (!storeId || !open) return
    let alive = true
    setLoading(true)
    setPage(1)
    const params = new URLSearchParams({ storeId, page: '1', limit: '20' })
    if (debouncedQuery) params.set('q', debouncedQuery)

    api
      .get(`/purchases/parties?${params.toString()}`)
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
      const res = await api.get(`/purchases/parties?${params.toString()}`)
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
          id="async-party-trigger"
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
                id="async-party-search-input"
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

  // Fetch page 1 whenever storeId, open, or debouncedQuery changes
  useEffect(() => {
    if (!storeId || !open) return
    let alive = true
    setLoading(true)
    setPage(1)
    const params = new URLSearchParams({ storeId, page: '1', limit: '20' })
    if (debouncedQuery) params.set('q', debouncedQuery)

    api
      .get(`/purchases/items?${params.toString()}`)
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
      const res = await api.get(`/purchases/items?${params.toString()}`)
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
          id="async-item-search-input"
          className="input"
          placeholder="Search & add inventory item by name, barcode, or HSN..."
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
        `/purchases/items/barcode/${encodeURIComponent(trimmed)}?storeId=${storeId}`
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
      title="Scan Inventory Item Barcode"
      subtitle="Use a USB/Bluetooth barcode scanner gun, your device camera, or type the barcode to add items to the purchase invoice."
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
      {/* USB Barcode Gun / Manual Barcode Input */}
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
                id="modal-barcode-input"
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

      {/* Camera Scanner Toggle */}
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

      {/* Recently Scanned Items Feed */}
      {recentScans.length > 0 && (
        <div>
          <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: 8 }}>
            Scanned & Added to Invoice ({recentScans.length}):
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

/* ------------------ Main Create Purchase Invoice Page --------------------- */

const getLocalTodayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CreatePurchase() {
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
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayStr)
  const [notes, setNotes] = useState('')

  // Invoice item lines
  const [lines, setLines] = useState([])

  // Quick inline barcode scan box
  const [quickBarcode, setQuickBarcode] = useState('')
  const [scanningQuick, setScanningQuick] = useState(false)
  const [scannerModalOpen, setScannerModalOpen] = useState(false)

  // Payment state
  const [paymentMode, setPaymentMode] = useState('unpaid') // 'unpaid' | 'full' | 'partial'
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [partialPaid, setPartialPaid] = useState('')

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

  // Add or increment an item in the purchase invoice lines
  const addItemToInvoice = (item) => {
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
        `/purchases/items/barcode/${encodeURIComponent(code)}?storeId=${selectedStoreId}`
      )
      addItemToInvoice(res.item)
      setQuickBarcode('')
      toast.success(`Added "${res.item.name}" via barcode`)
    } catch (err) {
      setServerError(err)
    } finally {
      setScanningQuick(false)
    }
  }

  const updateLine = (idx, key, value) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)))
  }

  const removeLine = (idx) => {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  // Live invoice totals
  const computed = useMemo(() => {
    let taxableAmount = 0
    let discountAmount = 0
    let gstAmount = 0
    let totalAmount = 0

    const lineDetails = lines.map((l) => {
      const qty = Math.max(0, Number(l.quantity) || 0)
      const rate = Math.max(0, Number(l.rate) || 0)
      const disc = Math.max(0, Number(l.discount) || 0)
      const gst = Math.max(0, Number(l.gst) || 0)
      const gross = Math.max(0, qty * rate - disc)

      let lineTaxable = gross
      let lineGst = 0
      let lineTotal = gross

      if (l.priceIncludesTax && gst > 0) {
        lineTaxable = gross / (1 + gst / 100)
        lineGst = gross - lineTaxable
        lineTotal = gross
      } else {
        lineGst = (gross * gst) / 100
        lineTotal = lineTaxable + lineGst
      }

      taxableAmount += lineTaxable
      discountAmount += disc
      gstAmount += lineGst
      totalAmount += lineTotal

      return {
        lineTaxable: Math.round(lineTaxable * 100) / 100,
        lineGst: Math.round(lineGst * 100) / 100,
        lineTotal: Math.round(lineTotal * 100) / 100,
      }
    })

    const grandTotal = Math.round(totalAmount * 100) / 100
    let paid = 0
    if (paymentMode === 'full') paid = grandTotal
    else if (paymentMode === 'partial') {
      paid = Math.min(grandTotal, Math.max(0, Number(partialPaid) || 0))
    }

    return {
      lineDetails,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      totalAmount: grandTotal,
      amountPaid: Math.round(paid * 100) / 100,
      balanceAmount: Math.round(Math.max(0, grandTotal - paid) * 100) / 100,
    }
  }, [lines, paymentMode, partialPaid])

  const submitInvoice = async (e) => {
    e.preventDefault()
    setServerError(null)
    const nextErrors = {}

    if (!selectedParty) nextErrors.party = 'Select a party / vendor'
    if (!invoiceNumber.trim()) nextErrors.invoiceNumber = 'Enter the vendor invoice number'
    if (!invoiceDate) nextErrors.invoiceDate = 'Select the invoice date'
    else if (invoiceDate > todayStr) nextErrors.invoiceDate = 'Future dates are not allowed'
    if (lines.length === 0) {
      nextErrors.items = 'Add at least one inventory item to the purchase invoice'
    } else {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (!l.quantity || Number(l.quantity) <= 0) {
          nextErrors.items = `Enter a valid quantity (> 0) for "${l.item.name}"`
          break
        }
        if (l.rate === '' || Number(l.rate) < 0 || isNaN(Number(l.rate))) {
          nextErrors.items = `Enter a valid purchase rate for "${l.item.name}"`
          break
        }
      }
    }

    if (paymentMode === 'partial' && (!Number(partialPaid) || Number(partialPaid) <= 0)) {
      nextErrors.partialPaid = 'Enter the partial amount paid'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const payload = {
        partyId: selectedParty.id,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        items: lines.map((l) => ({
          itemId: l.item.id,
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          priceIncludesTax: Boolean(l.priceIncludesTax),
          discount: Number(l.discount) || 0,
          gst: Number(l.gst) || 0,
        })),
        payments:
          computed.amountPaid > 0
            ? [{ amount: computed.amountPaid, method: paymentMethod }]
            : [],
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }

      const res = await api.post(`/purchases?storeId=${selectedStoreId}`, payload)
      toast.success(
        `Purchase Invoice #${res.invoice.invoiceNumber} created — stock & ledgers updated!`
      )
      navigate(`/purchases?storeId=${selectedStoreId}`)
    } catch (err) {
      setServerError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Top Bar */}
      <div
        className="toolbar"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Create Purchase Invoice</h2>
          <p className="muted">
            Select a vendor, search or scan inventory items by barcode, and post the purchase bill to stock & party ledgers.
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
                  setLines([])
                }}
                aria-label="Select Facility"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.storeCode})
                  </option>
                ))}
              </select>
            </div>
          ) : currentStore ? (
            <span className="badge" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
              <IconStore size={16} /> {currentStore.name} ({currentStore.storeCode})
            </span>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/purchases?storeId=${selectedStoreId}`)}
          >
            ← Back to Purchase Invoices
          </Button>
        </div>
      </div>

      <ErrorAlert error={serverError} />

      <form onSubmit={submitInvoice} noValidate>
        {/* Step 1: Party & Invoice Header Card */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="form-grid" style={{ gridTemplateColumns: '1.5fr 1fr 1fr', gap: 16 }}>
            <AsyncPartyDropdown
              storeId={selectedStoreId}
              selectedParty={selectedParty}
              onSelect={(party) => {
                setSelectedParty(party)
                setErrors((prev) => ({ ...prev, party: undefined }))
              }}
              error={errors.party}
            />

            <TextField
              id="create-pi-number"
              label="Vendor Invoice Number *"
              placeholder="e.g. INV-2026-104"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              error={errors.invoiceNumber}
            />

            <TextField
              id="create-pi-date"
              label="Invoice Date *"
              type="date"
              max={todayStr}
              value={invoiceDate}
              onChange={(e) => {
                const val = e.target.value
                setInvoiceDate(val > todayStr ? todayStr : val)
                setErrors((prev) => ({ ...prev, invoiceDate: undefined }))
              }}
              error={errors.invoiceDate}
            />
          </div>
        </div>

        {/* Step 2: Item Search & Barcode Scanner Bar */}
        <div className="card" style={{ marginBottom: 18 }}>
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
              <h3 style={{ fontSize: '1.05rem' }}>Add Inventory Items to Invoice</h3>
              <p className="muted" style={{ fontSize: '0.84rem' }}>
                Search items asynchronously by name/HSN or scan item barcodes directly.
              </p>
            </div>

            <Button
              id="open-barcode-scanner-btn"
              type="button"
              variant="primary"
              disabled={!selectedStoreId}
              onClick={() => setScannerModalOpen(true)}
            >
              <IconBarcode size={18} /> Scan Barcode
            </Button>
          </div>

          <div className="toolbar" style={{ marginBottom: 12 }}>
            {/* Async Item Search Dropdown */}
            <AsyncItemPicker
              storeId={selectedStoreId}
              onPickItem={(item) => {
                addItemToInvoice(item)
                setErrors((prev) => ({ ...prev, items: undefined }))
                toast.info(`Added "${item.name}"`)
              }}
            />

            {/* Quick Barcode Scan Input */}
            <div style={{ display: 'flex', gap: 8, minWidth: 290 }}>
              <div className="input-wrap" style={{ flex: 1 }}>
                <span className="lead">
                  <IconBarcode size={18} />
                </span>
                <input
                  id="quick-barcode-input"
                  className="input"
                  placeholder="Quick barcode scan & Enter..."
                  value={quickBarcode}
                  onChange={(e) => setQuickBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleQuickBarcodeSubmit(e)
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                loading={scanningQuick}
                onClick={handleQuickBarcodeSubmit}
              >
                <IconPlus size={16} /> Add
              </Button>
            </div>
          </div>

          {errors.items && <div className="alert alert-error">{errors.items}</div>}

          {/* Invoice Line Items Table */}
          {!canEditPricing && lines.length > 0 && (
            <div
              className="alert alert-info"
              style={{ marginBottom: 12, padding: '8px 14px', fontSize: '0.84rem', alignItems: 'center' }}
            >
              <IconLock size={16} />
              <span>
                Purchase Price, Incl. GST, and GST % are read-only for your account. Your Super Admin or Facility Admin can grant you access to edit them.
              </span>
            </div>
          )}

          <div className="table-wrap">
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Item & Barcode</th>
                  <th>Qty</th>
                  <th>Purchase Price (₹)</th>
                  <th>Incl. GST</th>
                  <th>Discount (₹)</th>
                  <th>GST %</th>
                  <th>Line Total</th>
                  <th>Projected Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty" style={{ padding: '36px 16px' }}>
                        <IconBox size={28} style={{ color: 'var(--ink-300)', marginBottom: 6 }} />
                        <div>No items added yet. Use the async search box or click <strong>Scan Barcode</strong> above.</div>
                      </div>
                    </td>
                  </tr>
                )}

                {lines.map((line, idx) => {
                  const it = line.item
                  const u = MEASURING_UNIT_SHORT[it.measuringUnit] || it.measuringUnit
                  const detail = computed.lineDetails[idx]
                  const newStock = Number((it.currentStock + (Number(line.quantity) || 0)).toFixed(4))
                  const pricingChanged =
                    canEditPricing &&
                    (Number(line.rate) !== Number(it.purchasePrice) ||
                      Boolean(line.priceIncludesTax) !== Boolean(it.purchasePriceWithTax) ||
                      Number(line.gst) !== Number(it.gst))

                  return (
                    <tr key={it.id} id={`purchase-line-${it.id}`}>
                      <td>
                        <strong>{it.name}</strong>
                        <small className="muted" style={{ display: 'block', fontFamily: 'monospace' }}>
                          {it.barcode} · HSN: {it.hsn}
                        </small>
                        {pricingChanged && (
                          <span
                            className="badge owner"
                            style={{ fontSize: '0.68rem', padding: '2px 7px', marginTop: 3 }}
                            title="Saving this invoice will also update this item's purchase price / GST in Inventory"
                          >
                            Updates Inventory
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            className="input"
                            style={{ width: 88, padding: '8px 10px' }}
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          />
                          <small className="muted" style={{ fontWeight: 600 }}>
                            {u}
                          </small>
                        </div>
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input"
                          disabled={!canEditPricing}
                          readOnly={!canEditPricing}
                          title={
                            canEditPricing
                              ? 'Edit purchase price (also updates inventory item)'
                              : 'Read-only: Permission required to change purchase price'
                          }
                          style={{
                            width: 110,
                            padding: '8px 10px',
                            background: !canEditPricing ? 'var(--cream-100)' : undefined,
                            cursor: !canEditPricing ? 'not-allowed' : undefined,
                          }}
                          value={line.rate}
                          onChange={(e) => canEditPricing && updateLine(idx, 'rate', e.target.value)}
                        />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          disabled={!canEditPricing}
                          checked={line.priceIncludesTax}
                          onChange={(e) =>
                            canEditPricing && updateLine(idx, 'priceIncludesTax', e.target.checked)
                          }
                          style={{ cursor: !canEditPricing ? 'not-allowed' : 'pointer' }}
                          title={
                            canEditPricing
                              ? 'Check if purchase price already includes GST (also updates inventory item)'
                              : 'Read-only: Permission required to change tax-inclusive setting'
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input"
                          style={{ width: 90, padding: '8px 10px' }}
                          value={line.discount}
                          onChange={(e) => updateLine(idx, 'discount', e.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          className="input"
                          disabled={!canEditPricing}
                          readOnly={!canEditPricing}
                          title={
                            canEditPricing
                              ? 'Edit GST % (also updates inventory item)'
                              : 'Read-only: Permission required to change GST %'
                          }
                          style={{
                            width: 76,
                            padding: '8px 10px',
                            background: !canEditPricing ? 'var(--cream-100)' : undefined,
                            cursor: !canEditPricing ? 'not-allowed' : undefined,
                          }}
                          value={line.gst}
                          onChange={(e) => canEditPricing && updateLine(idx, 'gst', e.target.value)}
                        />
                      </td>

                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {formatCurrency(detail?.lineTotal ?? 0)}
                        {detail?.lineGst > 0 && (
                          <small className="muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                            GST: {formatCurrency(detail.lineGst)}
                          </small>
                        )}
                      </td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="badge on" style={{ fontSize: '0.76rem' }}>
                          {it.currentStock} → {newStock} {u}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Remove item"
                          onClick={() => removeLine(idx)}
                        >
                          <IconTrash size={17} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Step 3: Payment & Invoice Summary Card */}
        <div className="two-col" style={{ alignItems: 'start', gap: 18 }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>Payment & Remarks</h3>
            <div className="tabs" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 14 }}>
              <button
                type="button"
                className={paymentMode === 'unpaid' ? 'active' : ''}
                onClick={() => setPaymentMode('unpaid')}
              >
                Unpaid (Credit)
              </button>
              <button
                type="button"
                className={paymentMode === 'full' ? 'active' : ''}
                onClick={() => setPaymentMode('full')}
              >
                Paid in Full
              </button>
              <button
                type="button"
                className={paymentMode === 'partial' ? 'active' : ''}
                onClick={() => setPaymentMode('partial')}
              >
                Partial Paid
              </button>
            </div>

            {paymentMode !== 'unpaid' && (
              <div className="form-grid">
                {paymentMode === 'partial' && (
                  <TextField
                    id="create-pi-partial"
                    label="Amount Paid Now (₹) *"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={partialPaid}
                    onChange={(e) => setPartialPaid(e.target.value)}
                    error={errors.partialPaid}
                  />
                )}
                <Field label="Payment Method" htmlFor="create-pi-method">
                  <select
                    id="create-pi-method"
                    className="input"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <TextField
              id="create-pi-notes"
              label="Notes / Remarks (optional)"
              placeholder="e.g. Received via morning delivery truck"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div
            className="card"
            style={{
              background: 'var(--plum-900)',
              color: '#fff',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d9c9e0', fontSize: '0.9rem' }}>
              <span>Items Count</span>
              <span>{lines.length} item(s)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d9c9e0', fontSize: '0.9rem' }}>
              <span>Taxable Amount</span>
              <span>{formatCurrency(computed.taxableAmount)}</span>
            </div>
            {computed.discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d9c9e0', fontSize: '0.9rem' }}>
                <span>Total Discount</span>
                <span>− {formatCurrency(computed.discountAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d9c9e0', fontSize: '0.9rem' }}>
              <span>Total GST</span>
              <span>+ {formatCurrency(computed.gstAmount)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.25rem',
                fontWeight: 700,
                borderTop: '1px solid rgba(255,255,255,0.14)',
                paddingTop: 10,
              }}
            >
              <span>Grand Total</span>
              <span style={{ color: 'var(--caramel-500)' }}>{formatCurrency(computed.totalAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#86efac', fontSize: '0.92rem' }}>
              <span>Amount Paid</span>
              <span>{formatCurrency(computed.amountPaid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem' }}>
              <span>Balance Payable (Added to Party Ledger)</span>
              <span style={{ color: computed.balanceAmount > 0 ? '#fda4af' : '#86efac' }}>
                {formatCurrency(computed.balanceAmount)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <Button
                type="button"
                variant="ghost"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
                onClick={() => navigate(`/purchases?storeId=${selectedStoreId}`)}
              >
                Cancel
              </Button>
              <Button
                id="save-purchase-invoice-btn"
                type="submit"
                variant="primary"
                block
                loading={submitting}
              >
                <IconReceipt size={18} /> Save Purchase Invoice
              </Button>
            </div>
          </div>
        </div>
      </form>

      {scannerModalOpen && (
        <BarcodeScannerModal
          storeId={selectedStoreId}
          onScannedItem={(item) => {
            addItemToInvoice(item)
            setErrors((prev) => ({ ...prev, items: undefined }))
            toast.success(`Scanned "${item.name}" (+1)`)
          }}
          onClose={() => setScannerModalOpen(false)}
        />
      )}
    </>
  )
}
