import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, ErrorAlert } from '../components/ui'
import {
  IconEdit,
  IconLedger,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconStore,
  IconTrash,
  IconTruck,
  IconWallet,
} from '../components/Icons'
import {
  CreatePurchaseInvoiceModal,
  DeletePartyModal,
  PartyFormModal,
  PartyLedgerModal,
  RecordPartyPaymentModal,
} from '../components/PartyModals'
import { MEASURING_UNIT_SHORT, formatCurrency, formatDate } from '../utils/helpers'

export default function Parties() {
  const { has } = useAuth()
  const toast = useToast()

  const canManageParty = has('party:manage')
  const canCreatePurchase = has('purchase:create') || has('party:manage')
  const canRecordPayment = has('payment:create') || has('party:manage')

  // Facility / Store state
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')

  // Active tab: 'parties' | 'purchases'
  const [activeTab, setActiveTab] = useState('parties')

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

  // Purchase Invoices state & filters
  const [purchasesData, setPurchasesData] = useState(null)
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [purchaseFilters, setPurchaseFilters] = useState({
    partyId: '',
    q: '',
    status: 'all',
    page: 1,
    limit: 25,
  })

  // Modal state: { type: 'add' | 'edit' | 'delete' | 'ledger' | 'payment' | 'purchase', party?: object }
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

  const loadPurchases = useCallback(async () => {
    if (!selectedStoreId || activeTab !== 'purchases') return
    setLoadingPurchases(true)
    try {
      const params = new URLSearchParams({
        storeId: selectedStoreId,
        status: purchaseFilters.status,
        page: String(purchaseFilters.page),
        limit: String(purchaseFilters.limit),
      })
      if (purchaseFilters.partyId) params.set('partyId', purchaseFilters.partyId)
      if (purchaseFilters.q.trim()) params.set('q', purchaseFilters.q.trim())

      const res = await api.get(`/parties/purchases?${params.toString()}`)
      setPurchasesData(res)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoadingPurchases(false)
    }
  }, [selectedStoreId, activeTab, purchaseFilters])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  const currentStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId),
    [stores, selectedStoreId]
  )

  const summary = partiesData?.summary

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
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Parties (Vendors) & Purchases</h2>
          <p className="muted">
            {canManageParty
              ? 'Manage store vendors, record purchase invoices, track item stock additions, and inspect party ledgers.'
              : 'Select a party to record purchase invoices and update store inventory.'}
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
                  setPurchaseFilters((p) => ({ ...p, partyId: '', page: 1 }))
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

          {canCreatePurchase && (
            <Button
              id="new-purchase-invoice-btn"
              variant={canManageParty ? 'ghost' : 'primary'}
              disabled={!selectedStoreId}
              onClick={() => setModal({ type: 'purchase', party: null })}
            >
              <IconReceipt size={18} /> New Purchase Invoice
            </Button>
          )}

          {canManageParty && (
            <Button
              id="add-party-btn"
              variant="primary"
              disabled={!selectedStoreId}
              onClick={() => setModal({ type: 'add' })}
            >
              <IconPlus size={18} /> Add Party
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid-stats" aria-label="Party summary">
        <div
          className="card stat"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setActiveTab('parties')
            setFilters((f) => ({ ...f, balance: 'all', page: 1 }))
          }}
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
          onClick={() => {
            setActiveTab('parties')
            setFilters((f) => ({
              ...f,
              balance: f.balance === 'payable' ? 'all' : 'payable',
              page: 1,
            }))
          }}
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
          onClick={() => {
            setActiveTab('parties')
            setFilters((f) => ({
              ...f,
              balance: f.balance === 'advance' ? 'all' : 'advance',
              page: 1,
            }))
          }}
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

      {/* View Switcher Tabs */}
      <div className="tabs" style={{ maxWidth: 440, marginBottom: 18 }} role="tablist">
        <button
          id="tab-parties-list"
          type="button"
          role="tab"
          aria-selected={activeTab === 'parties'}
          className={activeTab === 'parties' ? 'active' : ''}
          onClick={() => setActiveTab('parties')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconTruck size={17} /> Parties / Vendors ({partiesData?.total ?? 0})
          </span>
        </button>
        <button
          id="tab-purchase-invoices"
          type="button"
          role="tab"
          aria-selected={activeTab === 'purchases'}
          className={activeTab === 'purchases' ? 'active' : ''}
          onClick={() => setActiveTab('purchases')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconReceipt size={17} /> Purchase Invoices
          </span>
        </button>
      </div>

      <ErrorAlert error={error} />

      {/* ======================= TAB 1: PARTIES LIST ======================= */}
      {activeTab === 'parties' && (
        <>
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

            <button
              className="btn-icon"
              title="Refresh parties"
              aria-label="Refresh parties"
              onClick={loadParties}
            >
              <IconRefresh size={18} />
            </button>
          </div>

          <div className="table-wrap">
            <table style={{ minWidth: 880 }}>
              <thead>
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
                {loadingParties &&
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6].map((c) => (
                        <td key={c}>
                          <div className="skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loadingParties && (partiesData?.parties?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty">
                        No parties found matching your filters.{' '}
                        {canManageParty ? 'Click "Add Party" to add your first vendor.' : ''}
                      </div>
                    </td>
                  </tr>
                )}

                {!loadingParties &&
                  partiesData?.parties?.map((party) => {
                    const isPayable = party.balance > 0.004
                    const isAdvance = party.balance < -0.004

                    return (
                      <tr key={party.id} id={`party-row-${party.id}`}>
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
                            <small className="muted" style={{ display: 'block', marginTop: 3 }}>
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
                            onClick={() => setModal({ type: 'ledger', party })}
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
                              title="View Party Ledger & Purchased Items"
                              onClick={() => setModal({ type: 'ledger', party })}
                            >
                              <IconLedger size={15} /> Ledger
                            </Button>

                            {canCreatePurchase && party.isActive && (
                              <Button
                                id={`party-purchase-btn-${party.id}`}
                                size="sm"
                                variant="ghost"
                                title="Create Purchase Invoice from this Party"
                                onClick={() => setModal({ type: 'purchase', party })}
                              >
                                <IconReceipt size={15} /> + Purchase
                              </Button>
                            )}

                            {canRecordPayment && party.isActive && (
                              <button
                                className="btn-icon"
                                title="Record Payment Out to Party"
                                aria-label={`Record payment to ${party.name}`}
                                onClick={() => setModal({ type: 'payment', party })}
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
                                  onClick={() => setModal({ type: 'edit', party })}
                                >
                                  <IconEdit size={17} />
                                </button>
                                <button
                                  className="btn-icon"
                                  title="Delete Party"
                                  aria-label={`Delete ${party.name}`}
                                  onClick={() => setModal({ type: 'delete', party })}
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
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ==================== TAB 2: PURCHASE INVOICES ==================== */}
      {activeTab === 'purchases' && (
        <>
          <div className="toolbar">
            <div className="input-wrap grow">
              <span className="lead">
                <IconSearch size={18} />
              </span>
              <input
                className="input"
                placeholder="Search by invoice number..."
                value={purchaseFilters.q}
                onChange={(e) =>
                  setPurchaseFilters((p) => ({ ...p, q: e.target.value, page: 1 }))
                }
                aria-label="Search purchase invoices"
              />
            </div>

            <select
              className="input"
              value={purchaseFilters.partyId}
              onChange={(e) =>
                setPurchaseFilters((p) => ({ ...p, partyId: e.target.value, page: 1 }))
              }
              aria-label="Filter purchases by party"
            >
              <option value="">All Parties</option>
              {(partiesData?.parties ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={purchaseFilters.status}
              onChange={(e) =>
                setPurchaseFilters((p) => ({ ...p, status: e.target.value, page: 1 }))
              }
              aria-label="Filter purchases by payment status"
            >
              <option value="all">All Payment Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Fully Paid</option>
            </select>

            <button
              className="btn-icon"
              title="Refresh purchase invoices"
              onClick={loadPurchases}
            >
              <IconRefresh size={18} />
            </button>
          </div>

          <div className="table-wrap">
            <table style={{ minWidth: 920 }}>
              <thead>
                <tr>
                  <th>Invoice # & Date</th>
                  <th>Party / Vendor</th>
                  <th style={{ width: '38%' }}>Items Purchased (Price & Stock)</th>
                  <th>Total Bill</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {loadingPurchases &&
                  [1, 2, 3].map((i) => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6].map((c) => (
                        <td key={c}>
                          <div className="skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loadingPurchases && (purchasesData?.invoices?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty">
                        No purchase invoices found. Click "New Purchase Invoice" to record a purchase from a vendor.
                      </div>
                    </td>
                  </tr>
                )}

                {!loadingPurchases &&
                  purchasesData?.invoices?.map((inv) => (
                    <tr key={inv.id} style={{ verticalAlign: 'top' }}>
                      <td>
                        <strong>#{inv.invoiceNumber}</strong>
                        <small className="muted" style={{ display: 'block' }}>
                          {formatDate(inv.invoiceDate)}
                        </small>
                        {inv.user && (
                          <small className="muted">by {inv.user.userName}</small>
                        )}
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
                        <div style={{ display: 'grid', gap: 4 }}>
                          {inv.items.map((it, idx) => {
                            const u = MEASURING_UNIT_SHORT[it.measuringUnit] || it.measuringUnit
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  fontSize: '0.83rem',
                                  padding: '4px 8px',
                                  background: 'var(--cream-50)',
                                  borderRadius: 8,
                                }}
                              >
                                <span>
                                  <strong>{it.name}</strong> ·{' '}
                                  <span style={{ color: 'var(--green-500)', fontWeight: 600 }}>
                                    +{it.quantity} {u}
                                  </span>{' '}
                                  @ {formatCurrency(it.rate)}/{u}
                                </span>
                                {it.closingStock !== null && (
                                  <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                                    Stock: <strong>{it.closingStock} {u}</strong>
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700 }}>{formatCurrency(inv.totalAmount)}</div>
                        <small className="muted">GST: {formatCurrency(inv.gstAmount)}</small>
                      </td>

                      <td style={{ fontWeight: 600, color: 'var(--green-500)' }}>
                        {formatCurrency(inv.amountPaid)}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            inv.balanceAmount > 0.004 ? 'purchase' : 'on'
                          }`}
                        >
                          {inv.balanceAmount > 0.004
                            ? `${formatCurrency(inv.balanceAmount)} Due`
                            : 'Paid'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
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

      {modal?.type === 'payment' && (
        <RecordPartyPaymentModal
          storeId={selectedStoreId}
          party={modal.party}
          onClose={() => setModal(null)}
          onSaved={(_updated, msg) => {
            toast.success(msg)
            loadParties()
            if (activeTab === 'purchases') loadPurchases()
          }}
        />
      )}

      {modal?.type === 'purchase' && (
        <CreatePurchaseInvoiceModal
          storeId={selectedStoreId}
          initialParty={modal.party}
          onClose={() => setModal(null)}
          onSaved={(_inv, msg) => {
            toast.success(msg)
            loadParties()
            if (activeTab === 'purchases') loadPurchases()
          }}
        />
      )}

      {modal?.type === 'ledger' && (
        <PartyLedgerModal
          storeId={selectedStoreId}
          party={modal.party}
          canCreatePurchase={canCreatePurchase}
          canRecordPayment={canRecordPayment}
          onNewPurchase={(p) => setModal({ type: 'purchase', party: p })}
          onRecordPayment={(p) => setModal({ type: 'payment', party: p })}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

