import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { Button, ErrorAlert, Field, Modal, TextField } from './ui'
import {
  IconBuilding,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconTruck,
  IconWallet,
} from './Icons'
import {
  LEDGER_TYPE_LABELS,
  MEASURING_UNIT_SHORT,
  formatCurrency,
  formatDate,
  isEmail,
} from '../utils/helpers'

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

/* --------------------- Create Purchase Invoice Modal ---------------------- */

export function CreatePurchaseInvoiceModal({ storeId, initialParty, onClose, onSaved }) {
  const [parties, setParties] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [loadingInit, setLoadingInit] = useState(true)

  const [partyId, setPartyId] = useState(initialParty?.id ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const [lines, setLines] = useState([
    { itemId: '', quantity: 1, rate: '', priceIncludesTax: false, discount: 0, gst: 5 },
  ])

  const [paymentMode, setPaymentMode] = useState('unpaid') // 'unpaid' | 'full' | 'partial'
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [partialPaid, setPartialPaid] = useState('')

  const [error, setError] = useState('')
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    setLoadingInit(true)
    Promise.all([
      api.get(`/parties/options?storeId=${storeId}`),
      api.get(`/inventory/items?storeId=${storeId}&isActive=true&limit=500`),
    ])
      .then(([pRes, iRes]) => {
        if (!alive) return
        setParties(pRes.parties || [])
        setInventoryItems(iRes.items || [])
        if (!partyId && pRes.parties?.length > 0) {
          setPartyId(pRes.parties[0].id)
        }
      })
      .catch((err) => alive && setServerError(err))
      .finally(() => alive && setLoadingInit(false))
    return () => {
      alive = false
    }
  }, [storeId, partyId])

  const itemById = useMemo(
    () => Object.fromEntries(inventoryItems.map((it) => [it.id, it])),
    [inventoryItems]
  )

  const handleSelectLineItem = (idx, itemId) => {
    const it = itemById[itemId]
    setLines((prev) =>
      prev.map((line, i) =>
        i === idx
          ? {
              ...line,
              itemId,
              rate: it ? it.purchasePrice : '',
              priceIncludesTax: it ? Boolean(it.purchasePriceWithTax) : false,
              gst: it ? it.gst : 5,
            }
          : line
      )
    )
  }

  const updateLine = (idx, key, value) => {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, [key]: value } : line)))
  }

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { itemId: '', quantity: 1, rate: '', priceIncludesTax: false, discount: 0, gst: 5 },
    ])
  }

  const removeLine = (idx) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  // Live calculation per line & invoice totals
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
    else if (paymentMode === 'partial') paid = Math.min(grandTotal, Math.max(0, Number(partialPaid) || 0))

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

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    setError('')

    if (!partyId) return setError('Select a party / vendor')
    if (!invoiceNumber.trim()) return setError('Enter the vendor invoice number')

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (!l.itemId) return setError(`Select an inventory item on row #${i + 1}`)
      if (!l.quantity || Number(l.quantity) <= 0) return setError(`Enter a valid quantity on row #${i + 1}`)
      if (l.rate === '' || Number(l.rate) < 0 || isNaN(Number(l.rate))) {
        return setError(`Enter a valid purchase rate on row #${i + 1}`)
      }
    }

    if (paymentMode === 'partial' && (!Number(partialPaid) || Number(partialPaid) <= 0)) {
      return setError('Enter the partial payment amount')
    }

    setSubmitting(true)
    try {
      const payload = {
        partyId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        items: lines.map((l) => ({
          itemId: l.itemId,
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

      const res = await api.post(`/parties/purchases?storeId=${storeId}`, payload)
      onSaved(
        res.invoice,
        `Purchase Invoice #${res.invoice.invoiceNumber} saved — stock & party ledger updated!`
      )
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="New Purchase Invoice from Party"
      subtitle="Record items purchased from a vendor. Item stock, item ledgers, and the party ledger are updated automatically."
      onClose={onClose}
      maxWidth={960}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            id="submit-purchase-invoice-btn"
            type="submit"
            form="purchase-invoice-form"
            variant="primary"
            loading={submitting}
            disabled={loadingInit}
          >
            <IconReceipt size={16} /> Save Purchase & Update Ledgers
          </Button>
        </>
      }
    >
      <form id="purchase-invoice-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-grid" style={{ gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14 }}>
          <Field label="Party / Vendor *" htmlFor="pi-party">
            <select
              id="pi-party"
              className="input"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="">— Select Party —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.gstIn ? `(${p.gstIn})` : p.mobileNumber ? `(${p.mobileNumber})` : ''}
                </option>
              ))}
            </select>
          </Field>

          <TextField
            id="pi-number"
            label="Vendor Invoice Number *"
            placeholder="e.g. INV-2026-089"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />

          <TextField
            id="pi-date"
            label="Invoice Date *"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>

        {/* Purchased Items Table */}
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: '0.92rem' }}>Purchased Inventory Items</strong>
            <Button type="button" size="sm" variant="ghost" onClick={addLine}>
              <IconPlus size={15} /> Add Item Row
            </Button>
          </div>

          <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ minWidth: 860 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ width: '28%' }}>Inventory Item</th>
                  <th>Qty</th>
                  <th>Purchase Price (₹)</th>
                  <th>Incl. GST</th>
                  <th>Discount (₹)</th>
                  <th>GST %</th>
                  <th>Line Total</th>
                  <th>New Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const selectedItem = itemById[line.itemId]
                  const unitShort = selectedItem
                    ? MEASURING_UNIT_SHORT[selectedItem.measuringUnit] || selectedItem.measuringUnit
                    : ''
                  const detail = computed.lineDetails[idx]
                  const newStock = selectedItem
                    ? Number((selectedItem.currentStock + (Number(line.quantity) || 0)).toFixed(4))
                    : null

                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          className="input"
                          style={{ padding: '8px 10px', fontSize: '0.86rem' }}
                          value={line.itemId}
                          onChange={(e) => handleSelectLineItem(idx, e.target.value)}
                          aria-label={`Select item for row ${idx + 1}`}
                        >
                          <option value="">— Select Item —</option>
                          {inventoryItems.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.currentStock} {MEASURING_UNIT_SHORT[it.measuringUnit]})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            className="input"
                            style={{ width: 82, padding: '8px 10px' }}
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          />
                          {unitShort && (
                            <small className="muted" style={{ fontWeight: 600 }}>
                              {unitShort}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input"
                          style={{ width: 105, padding: '8px 10px' }}
                          placeholder="0.00"
                          value={line.rate}
                          onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={line.priceIncludesTax}
                          onChange={(e) => updateLine(idx, 'priceIncludesTax', e.target.checked)}
                          title="Check if purchase price already includes GST"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input"
                          style={{ width: 85, padding: '8px 10px' }}
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
                          style={{ width: 72, padding: '8px 10px' }}
                          value={line.gst}
                          onChange={(e) => updateLine(idx, 'gst', e.target.value)}
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
                        {newStock !== null ? (
                          <span className="badge on" style={{ fontSize: '0.76rem' }}>
                            {selectedItem.currentStock} → {newStock} {unitShort}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            className="btn-icon"
                            title="Remove row"
                            onClick={() => removeLine(idx)}
                          >
                            <IconTrash size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment & Summary Footer Grid */}
        <div className="two-col" style={{ alignItems: 'start', gap: 18 }}>
          <div className="card" style={{ padding: 16, background: 'var(--cream-50)' }}>
            <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: 10 }}>
              Payment Status for this Purchase
            </strong>
            <div className="tabs" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
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
              <div className="form-grid" style={{ marginBottom: 0 }}>
                {paymentMode === 'partial' && (
                  <TextField
                    id="pi-partial-amount"
                    label="Amount Paid Now (₹)"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={partialPaid}
                    onChange={(e) => setPartialPaid(e.target.value)}
                  />
                )}
                <Field label="Payment Method" htmlFor="pi-pay-method">
                  <select
                    id="pi-pay-method"
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
              id="pi-notes"
              label="Invoice Notes / Remarks (optional)"
              placeholder="e.g. Delivered by vendor van, verified weights"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div
            className="card"
            style={{
              padding: 18,
              background: 'var(--plum-900)',
              color: '#fff',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#d9c9e0' }}>
              <span>Taxable Amount</span>
              <span>{formatCurrency(computed.taxableAmount)}</span>
            </div>
            {computed.discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#d9c9e0' }}>
                <span>Total Discount</span>
                <span>− {formatCurrency(computed.discountAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#d9c9e0' }}>
              <span>Total GST</span>
              <span>+ {formatCurrency(computed.gstAmount)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.18rem',
                fontWeight: 700,
                borderTop: '1px solid rgba(255,255,255,0.14)',
                paddingTop: 8,
              }}
            >
              <span>Invoice Total</span>
              <span style={{ color: 'var(--caramel-500)' }}>{formatCurrency(computed.totalAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#86efac' }}>
              <span>Paid Now</span>
              <span>{formatCurrency(computed.amountPaid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700 }}>
              <span>Balance Added to Party Ledger</span>
              <span style={{ color: computed.balanceAmount > 0 ? '#fda4af' : '#86efac' }}>
                {formatCurrency(computed.balanceAmount)}
              </span>
            </div>
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
  canCreatePurchase,
  canRecordPayment,
  onNewPurchase,
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
          {canCreatePurchase && liveParty.isActive && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onClose()
                onNewPurchase(liveParty)
              }}
            >
              <IconReceipt size={16} /> New Purchase Invoice
            </Button>
          )}
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
                          : entry.type === 'payment_out'
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
                    {inv && entry.type === 'purchase_invoice' ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <strong>Invoice #{inv.invoiceNumber}</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--ink-500)' }}>
                            Taxable: {formatCurrency(inv.taxableAmount)} · GST: {formatCurrency(inv.gstAmount)} ·{' '}
                            {inv.balanceAmount > 0.004
                              ? `Due: ${formatCurrency(inv.balanceAmount)}`
                              : 'Fully Paid'}
                          </span>
                        </div>

                        {/* Itemized breakdown showing what was purchased, at what price, and resulting stock */}
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
                              <span>Item Purchased</span>
                              <span>Qty</span>
                              <span>Buy Price</span>
                              <span>Total (w/ GST)</span>
                              <span>Stock After</span>
                            </div>
                            {inv.items.map((it, idx) => {
                              const u = MEASURING_UNIT_SHORT[it.measuringUnit] || it.measuringUnit
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
                                  <div style={{ fontWeight: 600, color: 'var(--green-500)' }}>
                                    +{it.quantity} {u}
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
                            Against Invoice #{inv.invoiceNumber}
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
      {data && data.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
            fontSize: '0.86rem',
          }}
        >
          <span className="muted">
            Page {data.page} of {data.totalPages} ({data.total} entries)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
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
          </div>
        </div>
      )}
    </Modal>
  )
}

