import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, ErrorAlert, Modal } from '../components/ui'
import {
  IconEye,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconStore,
  IconTrash,
  IconTruck,
  IconWallet,
} from '../components/Icons'
import { MEASURING_UNIT_SHORT, ROLE_LABELS, formatCurrency, formatDate } from '../utils/helpers'

const ROW_HEIGHT = 76
const VIEWPORT_HEIGHT = 520
const OVERSCAN = 6

const getLocalTodayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ----------------------- Async Party Filter Dropdown ---------------------- */

function AsyncPartyFilter({ storeId, selectedParty, onSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [options, setOptions] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
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
      .get(`/purchases/parties?${params.toString()}`)
      .then((res) => {
        if (!alive) return
        setOptions(res.parties || [])
        setHasMore(Boolean(res.hasMore))
      })
      .catch(() => {
        if (!alive) return
        setOptions([])
        setHasMore(false)
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
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 230 }}>
      <div
        className="input"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          padding: '10px 12px',
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedParty ? selectedParty.name : 'All Parties / Vendors'}
        </span>
        {selectedParty ? (
          <button
            type="button"
            className="link-btn"
            style={{ fontSize: '0.78rem' }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(null)
              setQuery('')
            }}
          >
            Clear
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
            zIndex: 40,
            padding: 10,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <input
            className="input"
            style={{ padding: '8px 10px', marginBottom: 8, fontSize: '0.86rem' }}
            placeholder="Type party name, phone, or GSTIN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div
            style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 4 }}
            onScroll={handleScroll}
          >
            <button
              type="button"
              className="btn-ghost"
              style={{
                textAlign: 'left',
                padding: '7px 10px',
                borderRadius: 8,
                border: 0,
                fontSize: '0.86rem',
              }}
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
            >
              All Parties / Vendors
            </button>
            {loading && <div className="muted" style={{ padding: 8, fontSize: '0.84rem' }}>Searching...</div>}
            {!loading && options.length === 0 && (
              <div className="muted" style={{ padding: 8, fontSize: '0.84rem' }}>No matching parties found</div>
            )}
            {!loading &&
              options.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn-ghost"
                  style={{
                    textAlign: 'left',
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: 0,
                    fontSize: '0.86rem',
                  }}
                  onClick={() => {
                    onSelect(p)
                    setOpen(false)
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  {(p.mobileNumber || p.gstIn) && (
                    <small className="muted">
                      {[p.mobileNumber, p.gstIn].filter(Boolean).join(' · ')}
                    </small>
                  )}
                </button>
              ))}
            {loadingMore && (
              <div className="muted" style={{ padding: 8, textAlign: 'center', fontSize: '0.8rem' }}>
                Loading more...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* --------------------- Purchase Invoice Detail Modal ---------------------- */

function PurchaseInvoiceDetailModal({ storeId, invoice, canManage, onCancelled, onClose }) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  const handleCancelInvoice = async () => {
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await api.post(`/purchases/${invoice.id}/cancel?storeId=${storeId}`)
      onCancelled(res.message || `Purchase Invoice #${invoice.invoiceNumber} cancelled`)
      onClose()
    } catch (err) {
      setCancelError(err)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <Modal
      title={`Purchase Invoice #${invoice.invoiceNumber}`}
      subtitle={`Date: ${formatDate(invoice.invoiceDate)} · Vendor: ${invoice.party?.name ?? '—'}${
        invoice.user ? ` · Created by: ${invoice.user.userName}` : ''
      }`}
      onClose={onClose}
      maxWidth={880}
      footer={
        <>
          {canManage && !confirmCancel && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmCancel(true)}
            >
              <IconTrash size={16} /> Cancel Invoice & Reverse Stock
            </Button>
          )}
          {canManage && confirmCancel && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmCancel(false)}
              >
                Keep Invoice
              </Button>
              <Button
                id="confirm-cancel-purchase-btn"
                type="button"
                variant="danger"
                loading={cancelling}
                onClick={handleCancelInvoice}
              >
                Confirm Cancel Invoice
              </Button>
            </>
          )}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <ErrorAlert error={cancelError} />
      {confirmCancel && (
        <div className="alert alert-error">
          Are you sure you want to cancel <strong>Invoice #{invoice.invoiceNumber}</strong>? This will reverse the purchased item quantities from inventory stock and reverse the unpaid payable balance on the party ledger.
        </div>
      )}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 16,
          background: 'linear-gradient(120deg, var(--plum-800), var(--plum-950))',
          color: '#fff',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>Party / Vendor</small>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{invoice.party?.name ?? '—'}</div>
          {invoice.party?.gstIn && (
            <small style={{ color: '#d9c9e0', fontFamily: 'monospace' }}>GSTIN: {invoice.party.gstIn}</small>
          )}
        </div>
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>Taxable Amount</small>
          <div style={{ fontWeight: 600 }}>{formatCurrency(invoice.taxableAmount)}</div>
        </div>
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>GST Amount</small>
          <div style={{ fontWeight: 600 }}>{formatCurrency(invoice.gstAmount)}</div>
        </div>
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>Total Bill</small>
          <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--caramel-500)' }}>
            {formatCurrency(invoice.totalAmount)}
          </div>
        </div>
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>Paid / Balance Due</small>
          <div style={{ fontWeight: 600 }}>
            <span style={{ color: '#86efac' }}>{formatCurrency(invoice.amountPaid)}</span> /{' '}
            <span style={{ color: invoice.balanceAmount > 0.004 ? '#fda4af' : '#86efac' }}>
              {formatCurrency(invoice.balanceAmount)}
            </span>
          </div>
        </div>
      </div>

      <div className="table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
        <table style={{ minWidth: 740 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th>Item & Barcode</th>
              <th>Qty Purchased</th>
              <th>Buy Rate</th>
              <th>Discount</th>
              <th>GST</th>
              <th>Line Total</th>
              <th>Stock After</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => {
              const u = MEASURING_UNIT_SHORT[it.measuringUnit] || it.measuringUnit
              return (
                <tr key={idx}>
                  <td>
                    <strong>{it.name}</strong>
                    {it.barcode && (
                      <small className="muted" style={{ display: 'block', fontFamily: 'monospace' }}>
                        {it.barcode}
                      </small>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--green-500)' }}>
                    +{it.quantity} {u}
                  </td>
                  <td>
                    {formatCurrency(it.rate)} / {u}
                    <small className="muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                      {it.priceIncludesTax ? 'Incl. GST' : 'Excl. GST'}
                    </small>
                  </td>
                  <td>{it.discount > 0 ? formatCurrency(it.discount) : '—'}</td>
                  <td>
                    {it.gst}% ({formatCurrency(it.gstAmount)})
                  </td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(it.totalAmount)}</td>
                  <td>
                    {it.closingStock !== null && it.closingStock !== undefined ? (
                      <span className="code-pill" style={{ background: 'var(--plum-700)', fontSize: '0.75rem' }}>
                        {it.closingStock} {u}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {invoice.notes && (
        <p className="muted" style={{ marginTop: 12, fontSize: '0.86rem' }}>
          <strong>Notes:</strong> {invoice.notes}
        </p>
      )}
    </Modal>
  )
}

/* --------------------- Virtualized Purchases Table ------------------------ */

function VirtualizedPurchasesTable({ invoices, loading, onViewInvoice }) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)

  const totalCount = invoices.length
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT)
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(totalCount, startIndex + visibleCount + OVERSCAN * 2)

  const topSpacerHeight = startIndex * ROW_HEIGHT
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT)
  const visibleInvoices = invoices.slice(startIndex, endIndex)

  return (
    <div
      ref={containerRef}
      className="table-wrap"
      style={{ maxHeight: VIEWPORT_HEIGHT, overflowY: 'auto', position: 'relative' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <table style={{ minWidth: 920 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr>
            <th>Invoice # & Date</th>
            <th>Party / Vendor</th>
            <th>Items Summary</th>
            <th>Total Amount</th>
            <th>Paid</th>
            <th>Balance Status</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading &&
            [1, 2, 3, 4, 5].map((i) => (
              <tr key={i} style={{ height: ROW_HEIGHT }}>
                {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                  <td key={c}>
                    <div className="skeleton" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && totalCount === 0 && (
            <tr>
              <td colSpan={7}>
                <div className="empty">
                  No purchase invoices found. Click <strong>Create Purchase Invoice</strong> to record a new purchase.
                </div>
              </td>
            </tr>
          )}

          {!loading && totalCount > 0 && (
            <>
              {topSpacerHeight > 0 && (
                <tr aria-hidden="true" style={{ height: topSpacerHeight }}>
                  <td colSpan={7} style={{ padding: 0, border: 0 }} />
                </tr>
              )}

              {visibleInvoices.map((inv) => {
                const isUnpaid = inv.amountPaid <= 0.004 && inv.balanceAmount > 0.004
                const isPartial = inv.amountPaid > 0.004 && inv.balanceAmount > 0.004
                const firstTwo = inv.items.slice(0, 2)
                const extraCount = inv.items.length - firstTwo.length

                return (
                  <tr key={inv.id} style={{ height: ROW_HEIGHT }}>
                    <td>
                      <strong>#{inv.invoiceNumber}</strong>
                      <small className="muted" style={{ display: 'block' }}>
                        {formatDate(inv.invoiceDate)}
                      </small>
                    </td>

                    <td>
                      <strong>{inv.party?.name ?? '—'}</strong>
                      {inv.party?.gstIn && (
                        <small className="muted" style={{ display: 'block', fontFamily: 'monospace' }}>
                          {inv.party.gstIn}
                        </small>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: '0.84rem' }}>
                        {firstTwo.map((it, idx) => (
                          <span key={idx}>
                            {idx > 0 ? ', ' : ''}
                            <strong>{it.name}</strong> (+{it.quantity}{' '}
                            {MEASURING_UNIT_SHORT[it.measuringUnit] || it.measuringUnit})
                          </span>
                        ))}
                        {extraCount > 0 && (
                          <span className="badge" style={{ marginLeft: 6, fontSize: '0.72rem' }}>
                            +{extraCount} more
                          </span>
                        )}
                      </div>
                      {inv.user && (
                        <small className="muted">Recorded by {inv.user.userName}</small>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 700 }}>{formatCurrency(inv.totalAmount)}</div>
                      <small className="muted">GST: {formatCurrency(inv.gstAmount)}</small>
                    </td>

                    <td style={{ fontWeight: 600, color: 'var(--green-500)' }}>
                      {formatCurrency(inv.amountPaid)}
                    </td>

                    <td>
                      {isUnpaid ? (
                        <span className="badge purchase">
                          Unpaid ({formatCurrency(inv.balanceAmount)})
                        </span>
                      ) : isPartial ? (
                        <span className="badge owner">
                          Due: {formatCurrency(inv.balanceAmount)}
                        </span>
                      ) : (
                        <span className="badge on">Paid</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewInvoice(inv)}
                      >
                        <IconEye size={15} /> View
                      </Button>
                    </td>
                  </tr>
                )
              })}

              {bottomSpacerHeight > 0 && (
                <tr aria-hidden="true" style={{ height: bottomSpacerHeight }}>
                  <td colSpan={7} style={{ padding: 0, border: 0 }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------- Pagination Controls --------------------------- */

function PaginationBar({ page, totalPages, total, limit, onPageChange, onLimitChange }) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(total, page * limit)

  const pageNumbers = useMemo(() => {
    const pages = []
    const maxButtons = 5
    let first = Math.max(1, page - Math.floor(maxButtons / 2))
    let last = Math.min(totalPages, first + maxButtons - 1)
    if (last - first + 1 < maxButtons) {
      first = Math.max(1, last - maxButtons + 1)
    }
    for (let p = first; p <= last; p++) pages.push(p)
    return pages
  }, [page, totalPages])

  return (
    <div
      className="card"
      style={{
        marginTop: 14,
        padding: '12px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.88rem' }}>
        <span>
          Showing <strong>{start}–{end}</strong> of <strong>{total}</strong> invoices
        </span>
        {onLimitChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="muted">Rows per page:</span>
            <select
              className="input"
              style={{ width: 'auto', padding: '5px 10px', fontSize: '0.85rem' }}
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {[10, 25, 50, 100, 250].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPageChange(1)}>
          First
        </Button>
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </Button>
        {pageNumbers.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={p === page ? 'primary' : 'ghost'}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
        <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          Last
        </Button>
      </div>
    </div>
  )
}

/* ----------------------- Main Purchases List Page ------------------------- */

export default function Purchases() {
  const { user, has } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const todayStr = getLocalTodayStr()
  const isPurchaseStaff = user.role === 'purchase'
  const canCreate = has('purchase:create')
  const canManageInvoices =
    (user.role === 'owner' || user.role === 'admin') && has('purchase:cancel')

  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState(searchParams.get('storeId') || '')
  const [staffUsers, setStaffUsers] = useState([])

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchInput, setSearchInput] = useState('')
  const [selectedParty, setSelectedParty] = useState(null)
  const [filters, setFilters] = useState({
    q: '',
    userId: '',
    status: 'all',
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 25,
  })

  const [viewingInvoice, setViewingInvoice] = useState(null)

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
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [])

  // Load purchase staff users for the selected facility (for Owner & Facility Admin filter)
  useEffect(() => {
    if (!selectedStoreId || isPurchaseStaff) return
    let alive = true
    api
      .get(`/purchases/staff?storeId=${selectedStoreId}`)
      .then((res) => alive && setStaffUsers(res.users || []))
      .catch(() => alive && setStaffUsers([]))
    return () => {
      alive = false
    }
  }, [selectedStoreId, isPurchaseStaff])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput, page: 1 }))
    }, 280)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadPurchases = useCallback(async () => {
    if (!selectedStoreId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        storeId: selectedStoreId,
        status: filters.status,
        page: String(filters.page),
        limit: String(filters.limit),
      })
      if (filters.q.trim()) params.set('q', filters.q.trim())
      if (selectedParty?.id) params.set('partyId', selectedParty.id)
      if (!isPurchaseStaff && filters.userId) params.set('userId', filters.userId)
      if (!isPurchaseStaff && filters.fromDate) params.set('fromDate', filters.fromDate)
      if (!isPurchaseStaff && filters.toDate) params.set('toDate', filters.toDate)

      const res = await api.get(`/purchases?${params.toString()}`)
      setData(res)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [selectedStoreId, filters, selectedParty, isPurchaseStaff])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  const currentStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId),
    [stores, selectedStoreId]
  )

  const summary = data?.summary

  return (
    <>
      {/* Header Bar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Purchase Invoices</h2>
            {isPurchaseStaff ? (
              <span className="badge owner">Your Purchase Invoices (Today)</span>
            ) : (
              <span className="badge admin">All Facility Purchase Invoices</span>
            )}
          </div>
          <p className="muted">
            {isPurchaseStaff
              ? 'Showing purchase bills created by you today.'
              : 'View, filter by purchase staff or vendor, and manage all purchase invoices for this facility.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {stores.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconStore size={18} style={{ color: 'var(--rose-500)' }} />
              <select
                id="purchase-store-select"
                className="input"
                style={{ width: 'auto', minWidth: 210, fontWeight: 600 }}
                value={selectedStoreId}
                onChange={(e) => {
                  const nextId = e.target.value
                  setSelectedStoreId(nextId)
                  setSearchParams({ storeId: nextId })
                  setSelectedParty(null)
                  setFilters((f) => ({ ...f, userId: '', page: 1 }))
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

          {canCreate && (
            <Button
              id="go-create-purchase-btn"
              variant="primary"
              disabled={!selectedStoreId}
              onClick={() => navigate(`/purchases/new?storeId=${selectedStoreId}`)}
            >
              <IconPlus size={18} /> Create Purchase Invoice
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid-stats" aria-label="Purchases summary">
        <div className="card stat">
          <div className="ico">
            <IconReceipt />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 50, height: 28 }} />
            ) : (
              <div className="num">{summary.totalInvoices}</div>
            )}
            <div className="lbl">
              {isPurchaseStaff ? "Today's Invoices" : 'Total Purchase Invoices'}
            </div>
          </div>
        </div>

        <div className="card stat">
          <div
            className="ico"
            style={{ background: 'linear-gradient(135deg, #7c5cff, #b07cff)' }}
          >
            <IconTruck />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 90, height: 28 }} />
            ) : (
              <div className="num" style={{ fontSize: '1.4rem' }}>
                {formatCurrency(summary.totalPurchaseAmount)}
              </div>
            )}
            <div className="lbl">
              {isPurchaseStaff ? "Today's Purchase Total" : 'Total Purchase Value'}
            </div>
          </div>
        </div>

        <div className="card stat">
          <div
            className="ico"
            style={{ background: 'linear-gradient(135deg, #2fb38a, #5fd3a8)' }}
          >
            <IconWallet />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 90, height: 28 }} />
            ) : (
              <div className="num" style={{ fontSize: '1.4rem' }}>
                {formatCurrency(summary.totalPaidAmount)}
              </div>
            )}
            <div className="lbl">Total Paid</div>
          </div>
        </div>

        <div className="card stat">
          <div
            className="ico"
            style={{ background: 'linear-gradient(135deg, #e5484d, #f27c9d)' }}
          >
            <IconWallet />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 90, height: 28 }} />
            ) : (
              <div className="num" style={{ fontSize: '1.4rem' }}>
                {formatCurrency(summary.totalBalanceDue)}
              </div>
            )}
            <div className="lbl">Balance Due to Vendors</div>
          </div>
        </div>
      </div>

      <ErrorAlert error={error} />

      {/* Filters Toolbar */}
      <div className="toolbar">
        <div className="input-wrap grow">
          <span className="lead">
            <IconSearch size={18} />
          </span>
          <input
            id="purchase-invoice-search"
            className="input"
            placeholder="Search by vendor invoice number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search by invoice number"
          />
        </div>

        <AsyncPartyFilter
          storeId={selectedStoreId}
          selectedParty={selectedParty}
          onSelect={(party) => {
            setSelectedParty(party)
            setFilters((f) => ({ ...f, page: 1 }))
          }}
        />

        <select
          id="purchase-status-filter"
          className="input"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
          aria-label="Filter by payment status"
        >
          <option value="all">All Payment Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partially Paid</option>
          <option value="paid">Fully Paid</option>
        </select>

        {!isPurchaseStaff && (
          <>
            <select
              id="purchase-staff-filter"
              className="input"
              value={filters.userId}
              onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value, page: 1 }))}
              aria-label="Filter by purchase staff user"
            >
              <option value="">All Purchase Staff / Creators</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.userName} ({ROLE_LABELS[u.role] ?? u.role})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: '0.82rem' }}>From:</span>
              <input
                type="date"
                max={todayStr}
                className="input"
                style={{ width: 'auto', padding: '9px 10px' }}
                value={filters.fromDate}
                onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value, page: 1 }))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: '0.82rem' }}>To:</span>
              <input
                type="date"
                max={todayStr}
                className="input"
                style={{ width: 'auto', padding: '9px 10px' }}
                value={filters.toDate}
                onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value, page: 1 }))}
              />
            </div>
          </>
        )}

        <button
          className="btn-icon"
          title="Refresh purchase invoices"
          aria-label="Refresh purchase invoices"
          onClick={loadPurchases}
        >
          <IconRefresh size={18} />
        </button>
      </div>

      {/* Virtualized Purchase Invoices Table */}
      <VirtualizedPurchasesTable
        invoices={data?.invoices ?? []}
        loading={loading}
        onViewInvoice={(inv) => setViewingInvoice(inv)}
      />

      {data && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={filters.limit}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
        />
      )}

      {viewingInvoice && (
        <PurchaseInvoiceDetailModal
          storeId={selectedStoreId}
          invoice={viewingInvoice}
          canManage={canManageInvoices}
          onCancelled={(msg) => {
            toast.success(msg)
            loadPurchases()
          }}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </>
  )
}
