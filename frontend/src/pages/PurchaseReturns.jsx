import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Button, ErrorAlert, Modal } from '../components/ui'
import {
  IconEye,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconStore,
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
      .get(`/purchase-returns/parties?${params.toString()}`)
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
      const res = await api.get(`/purchase-returns/parties?${params.toString()}`)
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

/* --------------------- Purchase Return Detail Modal ----------------------- */

function PurchaseReturnDetailModal({ purchaseReturn, onClose }) {
  return (
    <Modal
      title={`Purchase Return #${purchaseReturn.purchaseReturnNumber}`}
      subtitle={`Date: ${formatDate(purchaseReturn.purchaseReturnDate)} · Vendor: ${
        purchaseReturn.party?.name ?? '—'
      }${
        purchaseReturn.linkedInvoice
          ? ` · Against Inv #${purchaseReturn.linkedInvoice.invoiceNumber}`
          : ''
      }${purchaseReturn.user ? ` · Created by: ${purchaseReturn.user.userName}` : ''}`}
      onClose={onClose}
      maxWidth={880}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
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
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{purchaseReturn.party?.name ?? '—'}</div>
          {purchaseReturn.party?.gstIn && (
            <small style={{ color: '#d9c9e0', fontFamily: 'monospace' }}>
              GSTIN: {purchaseReturn.party.gstIn}
            </small>
          )}
        </div>
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>Taxable Return</small>
          <div style={{ fontWeight: 600 }}>{formatCurrency(purchaseReturn.taxableAmount)}</div>
        </div>
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>GST Reversed</small>
          <div style={{ fontWeight: 600 }}>
            {formatCurrency(purchaseReturn.gstAmount)}
            <small style={{ display: 'block', fontSize: '0.7rem', color: '#cbb8d3' }}>
              CGST {formatCurrency(purchaseReturn.cgst)} + SGST {formatCurrency(purchaseReturn.sgst)}
            </small>
          </div>
        </div>
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>Total Return Value</small>
          <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--caramel-500)' }}>
            {formatCurrency(purchaseReturn.totalAmount)}
          </div>
        </div>
        <div>
          <small style={{ color: '#cbb8d3', fontSize: '0.76rem' }}>Refund Received / Party Balance Adj.</small>
          <div style={{ fontWeight: 600 }}>
            <span style={{ color: '#86efac' }}>{formatCurrency(purchaseReturn.amountReceived)}</span> /{' '}
            <span style={{ color: '#fda4af' }}>{formatCurrency(purchaseReturn.balanceAmount)}</span>
          </div>
        </div>
      </div>

      <div className="table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
        <table style={{ minWidth: 740 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th>Returned Item & Barcode</th>
              <th>Qty Returned (Reversed)</th>
              <th>Return Rate</th>
              <th>Discount</th>
              <th>GST</th>
              <th>Line Total</th>
              <th>Stock After Return</th>
            </tr>
          </thead>
          <tbody>
            {purchaseReturn.items.map((it, idx) => {
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
                  <td style={{ fontWeight: 700, color: 'var(--red-500)' }}>
                    −{it.quantity} {u}
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

      {purchaseReturn.notes && (
        <p className="muted" style={{ marginTop: 12, fontSize: '0.86rem' }}>
          <strong>Reason / Notes:</strong> {purchaseReturn.notes}
        </p>
      )}
    </Modal>
  )
}

/* ------------------ Virtualized Purchase Returns Table -------------------- */

function VirtualizedPurchaseReturnsTable({ returns, loading, onViewReturn }) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)

  const totalCount = returns.length
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT)
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(totalCount, startIndex + visibleCount + OVERSCAN * 2)

  const topSpacerHeight = startIndex * ROW_HEIGHT
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT)
  const visibleReturns = returns.slice(startIndex, endIndex)

  return (
    <div
      ref={containerRef}
      className="table-wrap"
      style={{ maxHeight: VIEWPORT_HEIGHT, overflowY: 'auto', position: 'relative' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <table style={{ minWidth: 940 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr>
            <th>Return # & Date</th>
            <th>Party / Vendor</th>
            <th>Returned Items (Stock Reversed)</th>
            <th>Total Return Amount</th>
            <th>Refund Received</th>
            <th>Party Balance Adjusted</th>
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
                  No purchase returns found. Click <strong>Create Purchase Return</strong> to return items to a vendor and adjust stock & party balance.
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

              {visibleReturns.map((ret) => {
                const firstTwo = ret.items.slice(0, 2)
                const extraCount = ret.items.length - firstTwo.length

                return (
                  <tr key={ret.id} style={{ height: ROW_HEIGHT }}>
                    <td>
                      <strong>#{ret.purchaseReturnNumber}</strong>
                      <small className="muted" style={{ display: 'block' }}>
                        {formatDate(ret.purchaseReturnDate)}
                      </small>
                      {ret.linkedInvoice && (
                        <span className="badge owner" style={{ fontSize: '0.68rem', marginTop: 2 }}>
                          Inv #{ret.linkedInvoice.invoiceNumber}
                        </span>
                      )}
                    </td>

                    <td>
                      <strong>{ret.party?.name ?? '—'}</strong>
                      {ret.party?.gstIn && (
                        <small className="muted" style={{ display: 'block', fontFamily: 'monospace' }}>
                          {ret.party.gstIn}
                        </small>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: '0.84rem' }}>
                        {firstTwo.map((it, idx) => (
                          <span key={idx}>
                            {idx > 0 ? ', ' : ''}
                            <strong>{it.name}</strong> (
                            <span style={{ color: 'var(--red-500)', fontWeight: 700 }}>
                              −{it.quantity} {MEASURING_UNIT_SHORT[it.measuringUnit] || it.measuringUnit}
                            </span>
                            )
                          </span>
                        ))}
                        {extraCount > 0 && (
                          <span className="badge" style={{ marginLeft: 6, fontSize: '0.72rem' }}>
                            +{extraCount} more
                          </span>
                        )}
                      </div>
                      {ret.user && (
                        <small className="muted">Recorded by {ret.user.userName}</small>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 700 }}>{formatCurrency(ret.totalAmount)}</div>
                      <small className="muted">GST: {formatCurrency(ret.gstAmount)}</small>
                    </td>

                    <td style={{ fontWeight: 600, color: 'var(--green-500)' }}>
                      {ret.amountReceived > 0.004 ? formatCurrency(ret.amountReceived) : '—'}
                    </td>

                    <td>
                      {ret.balanceAmount > 0.004 ? (
                        <span className="badge on">
                          −{formatCurrency(ret.balanceAmount)} Payable
                        </span>
                      ) : (
                        <span className="badge">Refunded in Full</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" variant="ghost" onClick={() => onViewReturn(ret)}>
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
          Showing <strong>{start}–{end}</strong> of <strong>{total}</strong> purchase returns
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

/* --------------------- Main Purchase Returns List Page -------------------- */

export default function PurchaseReturns() {
  const { user, has } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const todayStr = getLocalTodayStr()
  const isPurchaseStaff = user.role === 'purchase'
  const canCreate = has('purchase_return:create')

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
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 25,
  })

  const [viewingReturn, setViewingReturn] = useState(null)

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

  // Load purchase staff users for facility filter (Super Admin & Facility Admin)
  useEffect(() => {
    if (!selectedStoreId || isPurchaseStaff) return
    let alive = true
    api
      .get(`/purchase-returns/staff?storeId=${selectedStoreId}`)
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

  const loadPurchaseReturns = useCallback(async () => {
    if (!selectedStoreId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        storeId: selectedStoreId,
        page: String(filters.page),
        limit: String(filters.limit),
      })
      if (filters.q.trim()) params.set('q', filters.q.trim())
      if (selectedParty?.id) params.set('partyId', selectedParty.id)
      if (!isPurchaseStaff && filters.userId) params.set('userId', filters.userId)
      if (!isPurchaseStaff && filters.fromDate) params.set('fromDate', filters.fromDate)
      if (!isPurchaseStaff && filters.toDate) params.set('toDate', filters.toDate)

      const res = await api.get(`/purchase-returns?${params.toString()}`)
      setData(res)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [selectedStoreId, filters, selectedParty, isPurchaseStaff])

  useEffect(() => {
    loadPurchaseReturns()
  }, [loadPurchaseReturns])

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
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Purchase Returns (Debit Notes)</h2>
            {isPurchaseStaff ? (
              <span className="badge owner">Your Purchase Returns (Today)</span>
            ) : (
              <span className="badge admin">All Facility Purchase Returns</span>
            )}
          </div>
          <p className="muted">
            {isPurchaseStaff
              ? 'Showing purchase returns created by you today.'
              : 'View, filter, and create purchase returns that automatically reverse inventory stock and adjust party balances.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {stores.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconStore size={18} style={{ color: 'var(--rose-500)' }} />
              <select
                id="purchase-return-store-select"
                className="input"
                style={{ width: 'auto', minWidth: 220, fontWeight: 600 }}
                value={selectedStoreId}
                onChange={(e) => {
                  const nextId = e.target.value
                  setSelectedStoreId(nextId)
                  setSelectedParty(null)
                  setSearchParams({ storeId: nextId })
                  setFilters((f) => ({ ...f, userId: '', page: 1 }))
                }}
                aria-label="Select store facility"
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
            onClick={() => navigate(`/purchases?storeId=${selectedStoreId}`)}
          >
            <IconReceipt size={17} /> Purchase Invoices
          </Button>

          {canCreate && (
            <Button
              id="create-purchase-return-btn"
              variant="primary"
              onClick={() => navigate(`/purchase-returns/new?storeId=${selectedStoreId}`)}
            >
              <IconPlus size={17} /> Create Purchase Return
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid-stats" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <div className="ico">
            <IconRefresh />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 50, height: 26 }} />
            ) : (
              <div className="num">{summary.totalReturns}</div>
            )}
            <div className="lbl">
              {isPurchaseStaff ? "Today's Purchase Returns" : 'Total Purchase Returns'}
            </div>
          </div>
        </div>

        <div className="card stat">
          <div className="ico" style={{ background: '#fef3c7', color: 'var(--amber-500)' }}>
            <IconReceipt />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 80, height: 26 }} />
            ) : (
              <div className="num" style={{ fontSize: '1.25rem' }}>
                {formatCurrency(summary.totalReturnAmount)}
              </div>
            )}
            <div className="lbl">Total Returned Value</div>
          </div>
        </div>

        <div className="card stat">
          <div className="ico" style={{ background: '#e6f7f0', color: 'var(--green-500)' }}>
            <IconWallet />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 80, height: 26 }} />
            ) : (
              <div className="num" style={{ fontSize: '1.25rem', color: 'var(--green-500)' }}>
                {formatCurrency(summary.totalBalanceAdjusted)}
              </div>
            )}
            <div className="lbl">Party Payable Reduced</div>
          </div>
        </div>

        <div className="card stat">
          <div className="ico" style={{ background: '#ffe4ea', color: 'var(--rose-500)' }}>
            <IconWallet />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 80, height: 26 }} />
            ) : (
              <div className="num" style={{ fontSize: '1.25rem' }}>
                {formatCurrency(summary.totalRefundReceived)}
              </div>
            )}
            <div className="lbl">Cash / Bank Refund Received</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="input-wrap grow" style={{ minWidth: 220 }}>
          <span className="lead">
            <IconSearch size={18} />
          </span>
          <input
            id="purchase-return-search"
            className="input"
            placeholder="Search by return number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search purchase returns"
          />
        </div>

        {/* Async Party Search Filter */}
        <AsyncPartyFilter
          storeId={selectedStoreId}
          selectedParty={selectedParty}
          onSelect={(party) => {
            setSelectedParty(party)
            setFilters((f) => ({ ...f, page: 1 }))
          }}
        />

        {!isPurchaseStaff && (
          <>
            <select
              id="purchase-return-staff-filter"
              className="input"
              value={filters.userId}
              onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value, page: 1 }))}
              aria-label="Filter by purchase staff user"
            >
              <option value="">All Staff Users</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.userName} ({ROLE_LABELS[u.role] || u.role})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: '0.82rem' }}>From:</span>
              <input
                type="date"
                className="input"
                max={todayStr}
                style={{ width: 'auto', padding: '8px 10px' }}
                value={filters.fromDate}
                onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value, page: 1 }))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: '0.82rem' }}>To:</span>
              <input
                type="date"
                className="input"
                max={todayStr}
                style={{ width: 'auto', padding: '8px 10px' }}
                value={filters.toDate}
                onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value, page: 1 }))}
              />
            </div>
          </>
        )}

        {(filters.q || selectedParty || filters.userId || filters.fromDate || filters.toDate) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchInput('')
              setSelectedParty(null)
              setFilters((f) => ({
                ...f,
                q: '',
                userId: '',
                fromDate: '',
                toDate: '',
                page: 1,
              }))
            }}
          >
            <IconRefresh size={15} /> Reset
          </Button>
        )}
      </div>

      <ErrorAlert error={error} />

      {/* Virtualized Purchase Returns Table */}
      <VirtualizedPurchaseReturnsTable
        returns={data?.returns ?? []}
        loading={loading}
        onViewReturn={(ret) => setViewingReturn(ret)}
      />

      {/* Pagination Bar */}
      {data && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={filters.limit}
          onPageChange={(nextPage) => setFilters((f) => ({ ...f, page: nextPage }))}
          onLimitChange={(nextLimit) =>
            setFilters((f) => ({ ...f, limit: nextLimit, page: 1 }))
          }
        />
      )}

      {viewingReturn && (
        <PurchaseReturnDetailModal
          purchaseReturn={viewingReturn}
          onClose={() => setViewingReturn(null)}
        />
      )}
    </>
  )
}
