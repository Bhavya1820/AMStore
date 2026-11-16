import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, ErrorAlert } from '../components/ui'
import {
  IconEdit,
  IconLedger,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSheet,
  IconStore,
  IconTrash,
  IconTruck,
  IconWallet,
} from '../components/Icons'
import {
  BulkPartyUploadModal,
  DeletePartyModal,
  PartyFormModal,
  PartyLedgerModal,
  RecordPartyPaymentModal,
} from '../components/PartyModals'
import { formatCurrency, formatDate } from '../utils/helpers'

const ROW_HEIGHT = 72
const VIEWPORT_HEIGHT = 540
const OVERSCAN = 6

/* ----------------------- Virtualized Parties Table ------------------------ */

function VirtualizedPartiesTable({
  parties,
  loading,
  canManageParty,
  canRecordPayment,
  onOpenLedger,
  onRecordPayment,
  onEditParty,
  onDeleteParty,
}) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)

  const totalCount = parties.length
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT)
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(totalCount, startIndex + visibleCount + OVERSCAN * 2)

  const topSpacerHeight = startIndex * ROW_HEIGHT
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT)
  const visibleParties = parties.slice(startIndex, endIndex)

  const handleScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  return (
    <div
      ref={containerRef}
      className="table-wrap"
      style={{ maxHeight: VIEWPORT_HEIGHT, overflowY: 'auto', position: 'relative' }}
      onScroll={handleScroll}
    >
      <table style={{ minWidth: 880 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr>
            <th>Party / Vendor</th>
            <th>Contact</th>
            <th>GSTIN & Address</th>
            <th>Closing Balance</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading &&
            [1, 2, 3, 4, 5, 6].map((i) => (
              <tr key={i} style={{ height: ROW_HEIGHT }}>
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <td key={c}>
                    <div className="skeleton" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && totalCount === 0 && (
            <tr>
              <td colSpan={6}>
                <div className="empty">
                  No parties found matching your filters.{' '}
                  {canManageParty
                    ? 'Click "Add Party" or "Bulk Upload (Excel / PDF)" to add your vendors.'
                    : ''}
                </div>
              </td>
            </tr>
          )}

          {!loading && totalCount > 0 && (
            <>
              {topSpacerHeight > 0 && (
                <tr aria-hidden="true" style={{ height: topSpacerHeight }}>
                  <td colSpan={6} style={{ padding: 0, border: 0 }} />
                </tr>
              )}

              {visibleParties.map((party) => {
                const isPayable = party.balance > 0.004
                const isAdvance = party.balance < -0.004

                return (
                  <tr
                    key={party.id}
                    id={`party-row-${party.id}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <td>
                      <div className="cell-user">
                        <span className="avatar">
                          {party.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong>{party.name}</strong>
                          <small>Added {formatDate(party.createdAt)}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div>{party.mobileNumber || '—'}</div>
                      {party.email && <small className="muted">{party.email}</small>}
                    </td>

                    <td>
                      {party.gstIn ? (
                        <span
                          className="code-pill"
                          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                        >
                          {party.gstIn}
                        </span>
                      ) : (
                        <span className="muted">No GSTIN</span>
                      )}
                      {party.address && (
                        <small
                          className="muted"
                          style={{
                            display: 'block',
                            marginTop: 3,
                            maxWidth: 230,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={party.address}
                        >
                          {party.address}
                        </small>
                      )}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          isPayable ? 'purchase' : isAdvance ? 'on' : ''
                        }`}
                        style={{
                          fontSize: '0.86rem',
                          padding: '5px 12px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                        title="Click to open Party Ledger"
                        onClick={() => onOpenLedger(party)}
                      >
                        {formatCurrency(Math.abs(party.balance))}{' '}
                        {isPayable ? '(Payable)' : isAdvance ? '(Advance)' : '(Settled)'}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${party.isActive ? 'on' : 'off'}`}>
                        {party.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>

                    <td>
                      <div className="row-actions" style={{ gap: 6 }}>
                        <Button
                          id={`party-ledger-btn-${party.id}`}
                          size="sm"
                          variant="ghost"
                          title="View Party Ledger"
                          onClick={() => onOpenLedger(party)}
                        >
                          <IconLedger size={15} /> Ledger
                        </Button>

                        {canRecordPayment && party.isActive && (
                          <button
                            className="btn-icon"
                            title="Record Payment Out to Party"
                            aria-label={`Record payment to ${party.name}`}
                            onClick={() => onRecordPayment(party)}
                          >
                            <IconWallet size={17} />
                          </button>
                        )}

                        {canManageParty && (
                          <>
                            <button
                              className="btn-icon"
                              title="Edit Party"
                              aria-label={`Edit ${party.name}`}
                              onClick={() => onEditParty(party)}
                            >
                              <IconEdit size={17} />
                            </button>
                            <button
                              className="btn-icon"
                              title="Delete Party"
                              aria-label={`Delete ${party.name}`}
                              onClick={() => onDeleteParty(party)}
                            >
                              <IconTrash size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {bottomSpacerHeight > 0 && (
                <tr aria-hidden="true" style={{ height: bottomSpacerHeight }}>
                  <td colSpan={6} style={{ padding: 0, border: 0 }} />
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

function PaginationBar({ page, totalPages, total, limit, onPageChange, onLimitChange, renderedCount }) {
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
          Showing <strong>{start}–{end}</strong> of <strong>{total}</strong> parties
        </span>
        {renderedCount !== undefined && total > 0 && (
          <span className="badge" style={{ fontSize: '0.73rem' }}>
            Virtualized ({renderedCount} DOM rows)
          </span>
        )}
        {onLimitChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="muted">Rows per page:</span>
            <select
              id="party-page-limit"
              className="input"
              style={{ width: 'auto', padding: '5px 10px', fontSize: '0.85rem' }}
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {[10, 25, 50, 100, 250, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Button
          size="sm"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        >
          First
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
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

        <Button
          size="sm"
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          Last
        </Button>
      </div>
    </div>
  )
}

/* ----------------------------- Main Component ----------------------------- */

export default function Parties() {
  const { has } = useAuth()
  const toast = useToast()

  const canManageParty = has('party:manage')
  const canRecordPayment = has('payment:create') || has('party:manage')

  // Facility / Store state
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')

  // Parties state & filters
  const [partiesData, setPartiesData] = useState(null)
  const [loadingParties, setLoadingParties] = useState(true)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({
    q: '',
    status: 'active',
    balance: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
    page: 1,
    limit: 50,
  })

  // Modal state: { type: 'add' | 'bulk' | 'edit' | 'delete' | 'ledger' | 'payment', party?: object }
  const [modal, setModal] = useState(null)

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

  // Debounce party search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput, page: 1 }))
    }, 280)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadParties = useCallback(async () => {
    if (!selectedStoreId) return
    setLoadingParties(true)
    try {
      const params = new URLSearchParams({
        storeId: selectedStoreId,
        status: filters.status,
        balance: filters.balance,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: String(filters.page),
        limit: String(filters.limit),
      })
      if (filters.q.trim()) params.set('q', filters.q.trim())

      const res = await api.get(`/parties?${params.toString()}`)
      setPartiesData(res)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoadingParties(false)
    }
  }, [selectedStoreId, filters])

  useEffect(() => {
    loadParties()
  }, [loadParties])

  const currentStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId),
    [stores, selectedStoreId]
  )

  const summary = partiesData?.summary

  const hasActiveFilters =
    Boolean(searchInput) ||
    filters.balance !== 'all' ||
    filters.status !== 'active'

  const resetFilters = () => {
    setSearchInput('')
    setFilters({
      q: '',
      status: 'active',
      balance: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
      page: 1,
      limit: filters.limit,
    })
  }

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
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Parties / Vendors</h2>
          <p className="muted">
            Manage store vendors and click <strong>Ledger</strong> on any party to view its transaction and purchase history.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {stores.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconStore size={18} style={{ color: 'var(--rose-500)' }} />
              <select
                id="party-store-select"
                className="input"
                style={{ width: 'auto', minWidth: 210, fontWeight: 600 }}
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value)
                  setFilters((f) => ({ ...f, page: 1 }))
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

          {canManageParty && (
            <>
              <Button
                id="bulk-upload-party-btn"
                variant="ghost"
                disabled={!selectedStoreId}
                onClick={() => setModal({ type: 'bulk' })}
              >
                <IconSheet size={18} /> Bulk Upload (Excel / PDF)
              </Button>
              <Button
                id="add-party-btn"
                variant="primary"
                disabled={!selectedStoreId}
                onClick={() => setModal({ type: 'add' })}
              >
                <IconPlus size={18} /> Add Party
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid-stats" aria-label="Party summary">
        <div
          className="card stat"
          style={{ cursor: 'pointer' }}
          onClick={() => setFilters((f) => ({ ...f, balance: 'all', page: 1 }))}
        >
          <div className="ico">
            <IconTruck />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 50, height: 28 }} />
            ) : (
              <div className="num">{summary.totalParties}</div>
            )}
            <div className="lbl">
              Total Parties {summary ? `(${summary.activeParties} active)` : ''}
            </div>
          </div>
        </div>

        <div
          className="card stat"
          style={{
            cursor: 'pointer',
            borderColor: filters.balance === 'payable' ? 'var(--red-500)' : undefined,
          }}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              balance: f.balance === 'payable' ? 'all' : 'payable',
              page: 1,
            }))
          }
        >
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
                {formatCurrency(summary.totalPayable)}
              </div>
            )}
            <div className="lbl">
              Total Payable {summary ? `(${summary.payableCount} vendors)` : ''}
            </div>
          </div>
        </div>

        <div
          className="card stat"
          style={{
            cursor: 'pointer',
            borderColor: filters.balance === 'advance' ? 'var(--green-500)' : undefined,
          }}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              balance: f.balance === 'advance' ? 'all' : 'advance',
              page: 1,
            }))
          }
        >
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
                {formatCurrency(summary.totalAdvance)}
              </div>
            )}
            <div className="lbl">Advance with Vendors</div>
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
            id="party-search"
            className="input"
            placeholder="Search party by name, mobile number, GSTIN, or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search parties"
          />
        </div>

        <select
          id="party-filter-balance"
          className="input"
          value={filters.balance}
          onChange={(e) => setFilters((f) => ({ ...f, balance: e.target.value, page: 1 }))}
          aria-label="Filter by balance status"
        >
          <option value="all">All Balances</option>
          <option value="payable">Payable (Store Owes)</option>
          <option value="advance">Advance Paid</option>
          <option value="settled">Settled (₹0)</option>
        </select>

        <select
          id="party-filter-status"
          className="input"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
          aria-label="Filter by party status"
        >
          <option value="active">Active Parties</option>
          <option value="archived">Archived Parties</option>
          <option value="all">All Statuses</option>
        </select>

        <select
          id="party-sort"
          className="input"
          value={`${filters.sortBy}:${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split(':')
            setFilters((f) => ({ ...f, sortBy, sortOrder, page: 1 }))
          }}
          aria-label="Sort parties"
        >
          <option value="name:asc">Name (A → Z)</option>
          <option value="name:desc">Name (Z → A)</option>
          <option value="balance:desc">Payable (High → Low)</option>
          <option value="createdAt:desc">Newest First</option>
        </select>

        {hasActiveFilters && (
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            Clear Filters
          </Button>
        )}

        <button
          className="btn-icon"
          title="Refresh parties"
          aria-label="Refresh parties"
          onClick={loadParties}
        >
          <IconRefresh size={18} />
        </button>
      </div>

      {/* Virtualized Parties Table */}
      <VirtualizedPartiesTable
        parties={partiesData?.parties ?? []}
        loading={loadingParties}
        canManageParty={canManageParty}
        canRecordPayment={canRecordPayment}
        onOpenLedger={(party) => setModal({ type: 'ledger', party })}
        onRecordPayment={(party) => setModal({ type: 'payment', party })}
        onEditParty={(party) => setModal({ type: 'edit', party })}
        onDeleteParty={(party) => setModal({ type: 'delete', party })}
      />

      {partiesData && (
        <PaginationBar
          page={partiesData.page}
          totalPages={partiesData.totalPages}
          total={partiesData.total}
          limit={filters.limit}
          renderedCount={Math.min(
            partiesData.parties.length,
            Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2
          )}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
        />
      )}

      {/* ============================= MODALS ============================= */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <PartyFormModal
          storeId={selectedStoreId}
          party={modal.type === 'edit' ? modal.party : null}
          onClose={() => setModal(null)}
          onSaved={(_saved, msg) => {
            toast.success(msg)
            loadParties()
          }}
        />
      )}

      {modal?.type === 'delete' && (
        <DeletePartyModal
          storeId={selectedStoreId}
          party={modal.party}
          onClose={() => setModal(null)}
          onDeleted={(msg) => {
            toast.success(msg)
            loadParties()
          }}
        />
      )}

      {modal?.type === 'bulk' && (
        <BulkPartyUploadModal
          storeId={selectedStoreId}
          onClose={() => setModal(null)}
          onImported={(res) => {
            toast.success(`Imported ${res.importedCount} ${res.importedCount === 1 ? 'party' : 'parties'} successfully`)
            loadParties()
          }}
        />
      )}

      {modal?.type === 'payment' && (
        <RecordPartyPaymentModal
          storeId={selectedStoreId}
          party={modal.party}
          onClose={() => setModal(null)}
          onSaved={(_updated, msg) => {
            toast.success(msg)
            loadParties()
          }}
        />
      )}

      {modal?.type === 'ledger' && (
        <PartyLedgerModal
          storeId={selectedStoreId}
          party={modal.party}
          canRecordPayment={canRecordPayment}
          onRecordPayment={(p) => setModal({ type: 'payment', party: p })}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
