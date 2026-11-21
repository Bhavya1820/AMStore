import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { Button, ErrorAlert, Field, Modal, TextField } from './ui'
import {
  IconBuilding,
  IconCheck,
  IconDownload,
  IconMail,
  IconMapPin,
  IconPhone,
  IconSheet,
  IconTruck,
  IconUpload,
  IconWallet,
} from './Icons'
import {
  LEDGER_TYPE_LABELS,
  MEASURING_UNIT_SHORT,
  formatCurrency,
  formatDate,
  isEmail,
} from '../utils/helpers'
import {
  DEMO_PARTY_ROWS,
  PARTY_COLUMNS,
  downloadDemoPartiesFile,
  parsePartyBulkFile,
} from '../utils/partyBulk'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank Transfer / NEFT' },
]

/* ------------------------ Add / Edit Party Modal ------------------------- */

export function PartyFormModal({ storeId, party, onClose, onSaved }) {
  const isEdit = Boolean(party)
  const [form, setForm] = useState({
    name: party?.name ?? '',
    mobileNumber: party?.mobileNumber ?? '',
    email: party?.email ?? '',
    gstIn: party?.gstIn ?? '',
    address: party?.address ?? '',
    openingBalance: 0,
    openingType: 'payable', // 'payable' (store owes party) | 'advance' (store paid party in advance)
    isActive: party?.isActive ?? true,
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: val }))
  }

  const validate = () => {
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Party name must be at least 2 characters'
    if (form.mobileNumber.trim() && form.mobileNumber.trim().length < 7) {
      next.mobileNumber = 'Enter a valid mobile number'
    }
    if (form.email.trim() && !isEmail(form.email.trim())) {
      next.email = 'Enter a valid email address'
    }
    if (form.gstIn.trim() && form.gstIn.trim().length !== 15) {
      next.gstIn = 'GSTIN must be 15 characters'
    }
    if (!isEdit && (isNaN(Number(form.openingBalance)) || Number(form.openingBalance) < 0)) {
      next.openingBalance = 'Enter a valid non-negative amount'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    if (!validate()) return

    setLoading(true)
    try {
      if (isEdit) {
        const payload = {
          name: form.name.trim(),
          mobileNumber: form.mobileNumber.trim(),
          email: form.email.trim().toLowerCase(),
          gstIn: form.gstIn.trim().toUpperCase(),
          address: form.address.trim(),
          isActive: Boolean(form.isActive),
        }
        const res = await api.patch(`/parties/${party.id}?storeId=${storeId}`, payload)
        onSaved(res.party, `Party "${res.party.name}" updated`)
      } else {
        const rawOpening = Math.abs(Number(form.openingBalance) || 0)
        const signedOpening = form.openingType === 'advance' ? -rawOpening : rawOpening
        const payload = {
          name: form.name.trim(),
          ...(form.mobileNumber.trim() ? { mobileNumber: form.mobileNumber.trim() } : {}),
          ...(form.email.trim() ? { email: form.email.trim().toLowerCase() } : {}),
          ...(form.gstIn.trim() ? { gstIn: form.gstIn.trim().toUpperCase() } : {}),
          ...(form.address.trim() ? { address: form.address.trim() } : {}),
          openingBalance: signedOpening,
        }
        const res = await api.post(`/parties?storeId=${storeId}`, payload)
        onSaved(res.party, `Party "${res.party.name}" created`)
      }
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={isEdit ? `Edit Party: ${party.name}` : 'Add New Party / Vendor'}
      subtitle={
        isEdit
          ? 'Update vendor contact and tax details.'
          : 'Add a vendor from whom your store purchases inventory items.'
      }
      onClose={onClose}
      maxWidth={600}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button id="save-party-btn" type="submit" form="party-form" variant="primary" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Party'}
          </Button>
        </>
      }
    >
      <form id="party-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />
        <div className="form-grid">
          <div className="span-2">
            <TextField
              id="party-name"
              label="Party / Vendor Name *"
              placeholder="e.g. Shree Krishna Dairy & Cocoa Suppliers"
              icon={<IconTruck size={18} />}
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />
          </div>

          <TextField
            id="party-mobile"
            label="Mobile Number"
            type="tel"
            placeholder="+91 9876543210"
            icon={<IconPhone size={18} />}
            value={form.mobileNumber}
            onChange={set('mobileNumber')}
            error={errors.mobileNumber}
          />

          <TextField
            id="party-email"
            label="Email Address"
            type="email"
            placeholder="billing@vendor.com"
            icon={<IconMail size={18} />}
            value={form.email}
            onChange={set('email')}
            error={errors.email}
          />

          <div className="span-2">
            <TextField
              id="party-gstin"
              label="GSTIN (15-digit)"
              maxLength={15}
              style={{ textTransform: 'uppercase' }}
              placeholder="27AAAAA0000A1Z5"
              icon={<IconBuilding size={18} />}
              value={form.gstIn}
              onChange={set('gstIn')}
              error={errors.gstIn}
            />
          </div>

          <div className="span-2">
            <TextField
              id="party-address"
              label="Billing / Warehouse Address"
              placeholder="Plot 12, Industrial Estate, City"
              icon={<IconMapPin size={18} />}
              value={form.address}
              onChange={set('address')}
            />
          </div>

          {!isEdit && (
            <>
              <TextField
                id="party-opening-balance"
                label="Opening Balance (₹)"
                type="number"
                min="0"
                step="0.01"
                value={form.openingBalance}
                onChange={set('openingBalance')}
                error={errors.openingBalance}
                hint="Recorded automatically in Party Ledger"
              />
              <Field label="Opening Balance Type" htmlFor="party-opening-type">
                <select
                  id="party-opening-type"
                  className="input"
                  value={form.openingType}
                  onChange={set('openingType')}
                >
                  <option value="payable">Payable (Store owes Party)</option>
                  <option value="advance">Advance (Store paid Party in advance)</option>
                </select>
              </Field>
            </>
          )}

          {isEdit && (
            <div className="span-2">
              <div className="perm-item">
                <div>
                  <strong>Party Active Status</strong>
                  <small>Archived parties are hidden from new purchase invoices but keep their ledger history</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={set('isActive')}
                    aria-label="Party Active Status"
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

/* --------------------------- Delete Party Modal --------------------------- */

export function DeletePartyModal({ storeId, party, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(null)

  const handleConfirm = async () => {
    setLoading(true)
    setServerError(null)
    try {
      const res = await api.delete(`/parties/${party.id}?storeId=${storeId}`)
      const msg =
        res.mode === 'archived'
          ? `Party "${party.name}" has existing ledger history and was archived safely.`
          : `Party "${party.name}" deleted permanently.`
      onDeleted(msg)
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`Delete Party: ${party.name}?`}
      onClose={onClose}
      maxWidth={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button id="confirm-delete-party-btn" variant="danger" loading={loading} onClick={handleConfirm}>
            Delete Party
          </Button>
        </>
      }
    >
      <ErrorAlert error={serverError} />
      <p style={{ lineHeight: 1.55 }}>
        Are you sure you want to delete <strong>{party.name}</strong>?
      </p>
      <p className="muted" style={{ marginTop: 8, fontSize: '0.86rem' }}>
        Note: If this party already has purchase invoices or ledger entries, it will be safely{' '}
        <strong>archived</strong> so your store's financial and stock ledgers remain intact.
      </p>
    </Modal>
  )
}

/* ------------------------ Record Party Payment Modal ---------------------- */

export function RecordPartyPaymentModal({ storeId, party, onClose, onSaved }) {
  const [openInvoices, setOpenInvoices] = useState([])
  const [form, setForm] = useState({
    amount: party.balance > 0 ? party.balance : '',
    method: 'cash',
    invoiceId: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [error, setError] = useState('')
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .get(`/parties/${party.id}/open-invoices?storeId=${storeId}`)
      .then((res) => alive && setOpenInvoices(res.invoices || []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [storeId, party.id])

  const selectedInvoice = useMemo(
    () => openInvoices.find((i) => i.id === form.invoiceId),
    [openInvoices, form.invoiceId]
  )

  const handleInvoiceSelect = (e) => {
    const invId = e.target.value
    const inv = openInvoices.find((i) => i.id === invId)
    setForm((f) => ({
      ...f,
      invoiceId: invId,
      amount: inv ? inv.balanceAmount : f.amount,
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    const amt = Number(form.amount)
    if (!amt || isNaN(amt) || amt <= 0) {
      return setError('Payment amount must be greater than 0')
    }
    if (selectedInvoice && amt > selectedInvoice.balanceAmount + 0.004) {
      return setError(`Amount exceeds open balance (${formatCurrency(selectedInvoice.balanceAmount)}) for this invoice`)
    }
    setError('')

    setLoading(true)
    try {
      const payload = {
        amount: amt,
        method: form.method,
        ...(form.date ? { date: form.date } : {}),
        ...(form.invoiceId ? { invoiceId: form.invoiceId } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      }
      const res = await api.post(`/parties/${party.id}/payments?storeId=${storeId}`, payload)
      onSaved(res.party, `Recorded payment of ${formatCurrency(amt)} to ${party.name}`)
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`Record Payment to ${party.name}`}
      subtitle="Record a payment out (cash, UPI, card, or bank transfer) and update the party ledger."
      onClose={onClose}
      maxWidth={520}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button id="submit-party-payment-btn" type="submit" form="party-payment-form" variant="primary" loading={loading}>
            <IconWallet size={16} /> Record Payment
          </Button>
        </>
      }
    >
      <form id="party-payment-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />

        <div
          className="card"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            background: 'var(--cream-50)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <small className="muted">Current Party Balance</small>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: party.balance > 0 ? 'var(--red-500)' : 'var(--green-500)' }}>
              {formatCurrency(Math.abs(party.balance))}{' '}
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {party.balance > 0.004 ? '(Payable)' : party.balance < -0.004 ? '(Advance)' : '(Settled)'}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <small className="muted">Balance After Payment</small>
            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              {formatCurrency(Math.abs(party.balance - (Number(form.amount) || 0)))}{' '}
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-500)' }}>
                {party.balance - (Number(form.amount) || 0) > 0.004
                  ? '(Payable)'
                  : party.balance - (Number(form.amount) || 0) < -0.004
                  ? '(Advance)'
                  : '(Settled)'}
              </span>
            </div>
          </div>
        </div>

        <div className="form-grid">
          {openInvoices.length > 0 && (
            <div className="span-2">
              <Field label="Settle Against Purchase Invoice (optional)" htmlFor="pay-invoice">
                <select
                  id="pay-invoice"
                  className="input"
                  value={form.invoiceId}
                  onChange={handleInvoiceSelect}
                >
                  <option value="">— General On-Account Payment —</option>
                  {openInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      Invoice #{inv.invoiceNumber} · Due: {formatCurrency(inv.balanceAmount)} (Total: {formatCurrency(inv.totalAmount)})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <TextField
            id="pay-amount"
            label="Payment Amount (₹) *"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            error={error}
            autoFocus
          />

          <Field label="Payment Method *" htmlFor="pay-method">
            <select
              id="pay-method"
              className="input"
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="span-2">
            <TextField
              id="pay-date"
              label="Payment Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          <div className="span-2">
            <TextField
              id="pay-notes"
              label="Remarks / Reference Number"
              placeholder="e.g. UPI Ref #4123890123 / Paid via NEFT"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------------------- Party Ledger Modal -------------------------- */

export function PartyLedgerModal({
  storeId,
  party,
  canRecordPayment,
  onRecordPayment,
  onClose,
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    type: '',
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 25,
  })

  const loadLedger = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        storeId,
        page: String(filters.page),
        limit: String(filters.limit),
      })
      if (filters.type) params.set('type', filters.type)
      if (filters.fromDate) params.set('fromDate', filters.fromDate)
      if (filters.toDate) params.set('toDate', filters.toDate)

      const res = await api.get(`/parties/${party.id}/ledger?${params.toString()}`)
      setData(res)
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [storeId, party.id, filters])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  const liveParty = data?.party ?? party
  const totals = data?.totals

  return (
    <Modal
      title={`Party Ledger: ${liveParty.name}`}
      subtitle={[
        liveParty.gstIn && `GSTIN: ${liveParty.gstIn}`,
        liveParty.mobileNumber && `Phone: ${liveParty.mobileNumber}`,
        liveParty.email,
        liveParty.address,
      ]
        .filter(Boolean)
        .join(' · ') || 'Complete purchase, stock, and payment history with this vendor'}
      onClose={onClose}
      maxWidth={1020}
      footer={
        <>
          {canRecordPayment && liveParty.isActive && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onClose()
                onRecordPayment(liveParty)
              }}
            >
              <IconWallet size={16} /> Record Payment Out
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {/* Party Summary Banner */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: 16,
          background: 'linear-gradient(120deg, var(--plum-800), var(--plum-950))',
          color: '#fff',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.76rem', color: '#cbb8d3', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Net Closing Balance
          </div>
          <div
            style={{
              fontSize: '1.45rem',
              fontWeight: 700,
              color:
                liveParty.balance > 0.004
                  ? '#fda4af'
                  : liveParty.balance < -0.004
                  ? '#86efac'
                  : '#fff',
            }}
          >
            {formatCurrency(Math.abs(liveParty.balance))}{' '}
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              {liveParty.balance > 0.004
                ? 'Payable (Store Owes)'
                : liveParty.balance < -0.004
                ? 'Advance (Paid Extra)'
                : 'Settled'}
            </span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.76rem', color: '#cbb8d3' }}>Total Purchased ({totals?.purchaseCount ?? 0} bills)</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--caramel-500)' }}>
            {formatCurrency(totals?.totalPurchases ?? 0)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.76rem', color: '#cbb8d3' }}>Total Paid to Party</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#86efac' }}>
            {formatCurrency(totals?.totalPaid ?? 0)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.76rem', color: '#cbb8d3' }}>Opening Balance</div>
          <div style={{ fontWeight: 600 }}>
            {formatCurrency(Math.abs(liveParty.openingBalance ?? 0))}
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <select
          className="input"
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
          aria-label="Filter party ledger by transaction type"
        >
          <option value="">All Transactions</option>
          <option value="purchase_invoice">Purchase Invoices</option>
          <option value="payment_out">Payments Out</option>
          <option value="opening_balance">Opening Balance</option>
          <option value="purchase_return">Purchase Returns</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="muted" style={{ fontSize: '0.82rem' }}>From:</span>
          <input
            type="date"
            className="input"
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
            style={{ width: 'auto', padding: '8px 10px' }}
            value={filters.toDate}
            onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value, page: 1 }))}
          />
        </div>

        {(filters.type || filters.fromDate || filters.toDate) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFilters({ type: '', fromDate: '', toDate: '', page: 1, limit: 25 })}
          >
            Reset
          </Button>
        )}
      </div>

      <ErrorAlert error={error} />

      <div className="table-wrap" style={{ maxHeight: 430, overflowY: 'auto' }}>
        <table style={{ minWidth: 860 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th style={{ width: '44%' }}>Purchase & Itemized Stock Details</th>
              <th>Paid (−Dr)</th>
              <th>Purchased (+Cr)</th>
              <th>Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {!data &&
              [1, 2, 3].map((i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <td key={c}>
                      <div className="skeleton" />
                    </td>
                  ))}
                </tr>
              ))}

            {data && data.entries.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty" style={{ padding: '32px 12px' }}>
                    No ledger transactions recorded for this party yet.
                  </div>
                </td>
              </tr>
            )}

            {data?.entries.map((entry) => {
              const inv = entry.invoice
              return (
                <tr key={entry.id} style={{ verticalAlign: 'top' }}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.84rem', color: 'var(--ink-700)' }}>
                    <div>{formatDate(entry.date)}</div>
                    {entry.user && (
                      <small className="muted">by {entry.user.userName}</small>
                    )}
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        entry.type === 'purchase_invoice'
                          ? 'owner'
                          : entry.type === 'purchase_return'
                          ? 'purchase'
                          : entry.type === 'payment_out' || entry.type === 'payment_in'
                          ? 'on'
                          : ''
                      }`}
                    >
                      {LEDGER_TYPE_LABELS[entry.type] ?? entry.type}
                    </span>
                    {entry.payment?.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {entry.payment.map((p, idx) => (
                          <span
                            key={idx}
                            className="chip"
                            style={{ padding: '2px 7px', fontSize: '0.7rem', textTransform: 'uppercase' }}
                          >
                            {p.method}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td>
                    {inv && (entry.type === 'purchase_invoice' || entry.type === 'purchase_return') ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <strong>
                            {entry.type === 'purchase_return' ? 'Purchase Return' : 'Invoice'} #{inv.invoiceNumber}
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--ink-500)' }}>
                            Taxable: {formatCurrency(inv.taxableAmount)} · GST: {formatCurrency(inv.gstAmount)} ·{' '}
                            {entry.type === 'purchase_return'
                              ? inv.amountPaid > 0.004
                                ? `Refunded: ${formatCurrency(inv.amountPaid)}`
                                : 'Adjusted on Balance'
                              : inv.balanceAmount > 0.004
                              ? `Due: ${formatCurrency(inv.balanceAmount)}`
                              : 'Fully Paid'}
                          </span>
                        </div>

                        {/* Itemized breakdown showing what was purchased or returned, at what price, and resulting stock */}
                        {inv.items?.length > 0 && (
                          <div
                            style={{
                              background: 'var(--cream-50)',
                              border: '1px solid var(--cream-200)',
                              borderRadius: 10,
                              padding: '8px 10px',
                              fontSize: '0.8rem',
                            }}
                          >
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1.6fr 0.8fr 0.9fr 0.9fr 1fr',
                                gap: 6,
                                fontWeight: 700,
                                color: 'var(--ink-500)',
                                borderBottom: '1px solid var(--cream-200)',
                                paddingBottom: 4,
                                marginBottom: 4,
                                fontSize: '0.73rem',
                                textTransform: 'uppercase',
                              }}
                            >
                              <span>{entry.type === 'purchase_return' ? 'Item Returned' : 'Item Purchased'}</span>
                              <span>Qty</span>
                              <span>{entry.type === 'purchase_return' ? 'Return Rate' : 'Buy Price'}</span>
                              <span>Total (w/ GST)</span>
                              <span>Stock After</span>
                            </div>
                            {inv.items.map((it, idx) => {
                              const u = MEASURING_UNIT_SHORT[it.measuringUnit] || it.measuringUnit
                              const isReturn = entry.type === 'purchase_return'
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1.6fr 0.8fr 0.9fr 0.9fr 1fr',
                                    gap: 6,
                                    padding: '4px 0',
                                    borderBottom:
                                      idx < inv.items.length - 1
                                        ? '1px dashed var(--cream-200)'
                                        : 'none',
                                    alignItems: 'center',
                                  }}
                                >
                                  <div>
                                    <strong>{it.name}</strong>
                                    {it.barcode && (
                                      <small className="muted" style={{ display: 'block', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                        {it.barcode}
                                      </small>
                                    )}
                                  </div>
                                  <div style={{ fontWeight: 600, color: isReturn ? 'var(--red-500)' : 'var(--green-500)' }}>
                                    {isReturn ? '−' : '+'}{it.quantity} {u}
                                  </div>
                                  <div>
                                    {formatCurrency(it.rate)}/{u}
                                    <small className="muted" style={{ display: 'block', fontSize: '0.68rem' }}>
                                      GST {it.gst}%
                                    </small>
                                  </div>
                                  <div style={{ fontWeight: 600 }}>
                                    {formatCurrency(it.totalAmount)}
                                  </div>
                                  <div>
                                    {it.closingStock !== null && it.closingStock !== undefined ? (
                                      <span className="code-pill" style={{ fontSize: '0.72rem', padding: '2px 7px', background: 'var(--plum-700)' }}>
                                        {it.closingStock} {u}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {entry.remarks && (
                          <small className="muted">{entry.remarks}</small>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.88rem' }}>
                        {inv && (
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>
                            Against #{inv.invoiceNumber}
                          </div>
                        )}
                        <div>{entry.remarks || '—'}</div>
                      </div>
                    )}
                  </td>

                  <td style={{ fontWeight: 700, color: entry.debit > 0 ? 'var(--green-500)' : 'var(--ink-300)', whiteSpace: 'nowrap' }}>
                    {entry.debit > 0 ? `− ${formatCurrency(entry.debit)}` : '—'}
                  </td>

                  <td style={{ fontWeight: 700, color: entry.credit > 0 ? 'var(--red-500)' : 'var(--ink-300)', whiteSpace: 'nowrap' }}>
                    {entry.credit > 0 ? `+ ${formatCurrency(entry.credit)}` : '—'}
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span
                      className={`badge ${
                        entry.balance > 0.004
                          ? 'purchase'
                          : entry.balance < -0.004
                          ? 'on'
                          : ''
                      }`}
                      style={{ fontWeight: 700 }}
                    >
                      {formatCurrency(Math.abs(entry.balance))}{' '}
                      {entry.balance > 0.004 ? 'Cr' : entry.balance < -0.004 ? 'Adv' : ''}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {data && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginTop: 14,
            fontSize: '0.86rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="muted">
              Page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong> ({data.total} entries)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted">Rows:</span>
              <select
                className="input"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem' }}
                value={filters.limit}
                onChange={(e) => setFilters((f) => ({ ...f, limit: Number(e.target.value), page: 1 }))}
                aria-label="Ledger rows per page"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              size="sm"
              variant="ghost"
              disabled={data.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: 1 }))}
            >
              First
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={data.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={data.page >= data.totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            >
              Next
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={data.page >= data.totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: data.totalPages }))}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------ Bulk Party Upload Modal (Excel / PDF) ----------------- */

export function BulkPartyUploadModal({ storeId, onClose, onImported }) {
  const fileInputRef = useRef(null)
  const [tab, setTab] = useState('upload') // 'upload' | 'guide'
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState(null) // { rows, validRows, invalidRows }
  const [parseError, setParseError] = useState('')
  const [serverError, setServerError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const handleFileChange = async (file) => {
    if (!file) return
    setParseError('')
    setServerError(null)
    setResult(null)
    setFileName(file.name)
    try {
      const res = await parsePartyBulkFile(file)
      setParsed(res)
    } catch (err) {
      setParsed(null)
      setParseError(err.message || 'Could not parse the selected Excel / PDF file')
    }
  }

  const handleLoadDemoIntoPreview = () => {
    setParseError('')
    setServerError(null)
    setResult(null)
    setFileName('AMStore_Parties_Demo (Sample Data)')
    const rows = DEMO_PARTY_ROWS.map((r, i) => ({
      ...r,
      rowNumber: i + 2,
      valid: true,
      errors: [],
    }))
    setParsed({ rows, validRows: rows, invalidRows: [] })
    setTab('upload')
  }

  const handleImport = async () => {
    if (!parsed || parsed.validRows.length === 0) return
    setImporting(true)
    setServerError(null)
    try {
      const payload = {
        parties: parsed.validRows.map((r) => ({
          rowNumber: r.rowNumber,
          name: r.name,
          ...(r.mobileNumber ? { mobileNumber: r.mobileNumber } : {}),
          ...(r.email ? { email: r.email } : {}),
          ...(r.gstIn ? { gstIn: r.gstIn } : {}),
          ...(r.address ? { address: r.address } : {}),
          openingBalance: Number(r.openingBalance) || 0,
          openingType: r.openingType === 'advance' ? 'advance' : 'payable',
          ...(r.remarks ? { remarks: r.remarks } : {}),
        })),
      }
      const res = await api.post(`/parties/bulk?storeId=${storeId}`, payload)
      setResult(res)
      if (res.importedCount > 0) {
        onImported(res)
      }
    } catch (err) {
      setServerError(err)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      title="Bulk Add Parties / Vendors via Excel or PDF"
      subtitle="Upload an Excel (.xlsx), PDF (.pdf), or CSV (.csv) file to add multiple vendors and record their opening balance ledgers at once."
      onClose={onClose}
      maxWidth={960}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && parsed?.validRows?.length > 0 && (
            <Button
              id="confirm-bulk-party-import-btn"
              variant="primary"
              loading={importing}
              onClick={handleImport}
            >
              <IconUpload size={16} /> Import {parsed.validRows.length} Valid{' '}
              {parsed.validRows.length === 1 ? 'Party' : 'Parties'}
            </Button>
          )}
        </>
      }
    >
      {/* Top Sample Excel & Sample PDF Download Banner */}
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
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <strong style={{ fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSheet size={18} /> Download Sample Excel / PDF Template
          </strong>
          <small style={{ color: '#d9c9e0' }}>
            Get the ready-to-use sample vendor file in Excel (.xlsx), PDF (.pdf), or CSV (.csv) format.
          </small>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            id="download-party-demo-xlsx-btn"
            size="sm"
            variant="primary"
            type="button"
            onClick={() => downloadDemoPartiesFile('xlsx')}
          >
            <IconDownload size={15} /> Sample Excel (.xlsx)
          </Button>
          <Button
            id="download-party-demo-pdf-btn"
            size="sm"
            type="button"
            style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', borderColor: 'rgba(255,255,255,0.22)' }}
            onClick={() => downloadDemoPartiesFile('pdf')}
          >
            <IconDownload size={15} /> Sample PDF (.pdf)
          </Button>
          <Button
            id="download-party-demo-csv-btn"
            size="sm"
            type="button"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            onClick={() => downloadDemoPartiesFile('csv')}
          >
            <IconDownload size={15} /> Sample CSV (.csv)
          </Button>
        </div>
      </div>

      {/* View Switcher inside Modal */}
      <div className="tabs" style={{ maxWidth: 480, marginBottom: 16 }} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={tab === 'upload' ? 'active' : ''}
          onClick={() => setTab('upload')}
        >
          1. Upload Excel / PDF & Preview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'guide'}
          className={tab === 'guide' ? 'active' : ''}
          onClick={() => setTab('guide')}
        >
          2. Columns Guide & Sample Table
        </button>
      </div>

      <ErrorAlert error={serverError} />
      {parseError && <div className="alert alert-error">{parseError}</div>}

      {/* Import Result Banner */}
      {result && (
        <div
          className={`alert ${result.importedCount > 0 ? 'alert-success' : 'alert-info'}`}
          style={{ flexDirection: 'column', gap: 8 }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
            <IconCheck size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Imported {result.importedCount} {result.importedCount === 1 ? 'party' : 'parties'} successfully
            {result.skippedCount > 0 ? ` · ${result.skippedCount} skipped` : ''}.
          </div>
          {result.errors?.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: '0.84rem' }}>
              {result.errors.map((e, idx) => (
                <li key={idx}>
                  Row {e.row} (<strong>{e.name}</strong>): {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <>
          {/* Quick Column Pill Strip */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              marginBottom: 16,
              background: 'var(--cream-50)',
              fontSize: '0.84rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>File Columns (Header Row):</strong>
              <button
                type="button"
                className="link-btn"
                style={{ fontSize: '0.82rem' }}
                onClick={() => setTab('guide')}
              >
                View full column specs & sample sheet →
              </button>
            </div>
            <div className="chips" style={{ marginTop: 4 }}>
              {PARTY_COLUMNS.map((c) => (
                <span
                  key={c.key}
                  className="chip"
                  style={{
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    fontSize: '0.76rem',
                    borderColor: c.required ? 'var(--rose-400)' : undefined,
                    background: c.required ? '#fff0f4' : '#fff',
                  }}
                  title={`${c.label}: ${c.description}`}
                >
                  {c.header}
                  {c.required ? ' *' : ''}
                </span>
              ))}
            </div>
          </div>

          {/* File Dropzone */}
          <div
            className="card"
            style={{
              border: '2px dashed var(--ink-300)',
              background: '#fff',
              textAlign: 'center',
              padding: '26px 20px',
              marginBottom: 16,
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const dropped = e.dataTransfer.files?.[0]
              if (dropped) handleFileChange(dropped)
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.pdf,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
            <IconUpload size={28} style={{ color: 'var(--rose-500)', marginBottom: 8 }} />
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>
              {fileName
                ? `Selected: ${fileName}`
                : 'Click to select or drag & drop your Excel (.xlsx), PDF (.pdf), or CSV file'}
            </div>
            <p className="muted" style={{ marginTop: 4, fontSize: '0.84rem' }}>
              Supports Microsoft Excel (.xlsx), PDF (.pdf), and CSV (.csv) up to 10,000 parties per upload.
            </p>
            <div
              style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File (.xlsx / .pdf / .csv)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={handleLoadDemoIntoPreview}
              >
                Load Sample Parties into Preview
              </Button>
            </div>
          </div>

          {/* Parsed Rows Preview Table */}
          {parsed && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  File Preview: {parsed.rows.length} rows detected (
                  <span style={{ color: 'var(--green-500)' }}>{parsed.validRows.length} valid</span>
                  {parsed.invalidRows.length > 0 && (
                    <>
                      ,{' '}
                      <span style={{ color: 'var(--red-500)' }}>
                        {parsed.invalidRows.length} with errors
                      </span>
                    </>
                  )}
                  )
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setParsed(null)
                    setFileName('')
                    setResult(null)
                  }}
                >
                  Clear Preview
                </Button>
              </div>

              <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ minWidth: 860 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th>Row</th>
                      <th>Status</th>
                      <th>name</th>
                      <th>mobileNumber</th>
                      <th>email</th>
                      <th>gstIn</th>
                      <th>address</th>
                      <th>openingBalance</th>
                      <th>openingType</th>
                      <th>remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 100).map((r) => (
                      <tr key={r.rowNumber}>
                        <td>#{r.rowNumber}</td>
                        <td>
                          {r.valid ? (
                            <span className="badge on">Ready</span>
                          ) : (
                            <span className="badge purchase" title={r.errors.join('; ')}>
                              {r.errors[0]}
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>{r.name || '—'}</strong>
                        </td>
                        <td>{r.mobileNumber || '—'}</td>
                        <td>{r.email || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.gstIn || '—'}</td>
                        <td>{r.address || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(r.openingBalance)}</td>
                        <td>
                          <span className={`badge ${r.openingType === 'advance' ? 'on' : 'owner'}`}>
                            {r.openingType}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--ink-500)' }}>
                          {r.remarks || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length > 100 && (
                <p className="muted" style={{ marginTop: 8, fontSize: '0.82rem' }}>
                  Showing first 100 of {parsed.rows.length} rows in preview. All {parsed.validRows.length} valid parties will be imported.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'guide' && (
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Column Reference Table */}
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>
              Excel / PDF Column Specifications
            </h3>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
              Use these column names in the header row of your Excel sheet or PDF table. Only <code>name</code> is required; all other columns are optional.
            </p>
            <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table style={{ minWidth: 740 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th>Column Header</th>
                    <th>Field Label</th>
                    <th>Required</th>
                    <th>Data Type</th>
                    <th>Example Value</th>
                    <th>Description / Accepted Values</th>
                  </tr>
                </thead>
                <tbody>
                  {PARTY_COLUMNS.map((col) => (
                    <tr key={col.key}>
                      <td>
                        <code
                          style={{
                            background: 'var(--cream-100)',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontWeight: 700,
                          }}
                        >
                          {col.header}
                        </code>
                      </td>
                      <td>{col.label}</td>
                      <td>
                        <span className={`badge ${col.required ? 'owner' : 'off'}`}>
                          {col.required ? 'Required *' : 'Optional'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.84rem' }}>{col.type}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        {col.example}
                      </td>
                      <td style={{ fontSize: '0.84rem', color: 'var(--ink-700)' }}>
                        {col.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Demo Table Live Preview */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                <h3 style={{ fontSize: '1rem' }}>Sample Excel / PDF Sheet Preview</h3>
                <p className="muted" style={{ fontSize: '0.84rem' }}>
                  This is the exact data inside the downloadable Sample Excel (.xlsx) and Sample PDF (.pdf) files.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" variant="ghost" type="button" onClick={handleLoadDemoIntoPreview}>
                  Load Sample into Importer
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => downloadDemoPartiesFile('pdf')}>
                  <IconDownload size={14} /> Download .pdf
                </Button>
                <Button size="sm" variant="primary" type="button" onClick={() => downloadDemoPartiesFile('xlsx')}>
                  <IconDownload size={14} /> Download .xlsx
                </Button>
              </div>
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 920, fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    {PARTY_COLUMNS.map((c) => (
                      <th key={c.key} style={{ textTransform: 'none', fontFamily: 'monospace' }}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO_PARTY_ROWS.map((row, idx) => (
                    <tr key={idx}>
                      {PARTY_COLUMNS.map((c) => (
                        <td key={c.key}>{String(row[c.key] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
