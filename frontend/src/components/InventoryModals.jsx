import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { Button, ErrorAlert, Field, Modal, TextField } from './ui'
import {
  IconBarcode,
  IconBox,
  IconCheck,
  IconDownload,
  IconLayers,
  IconPlus,
  IconRefresh,
  IconSheet,
  IconTag,
  IconUpload,
} from './Icons'
import {
  LEDGER_TYPE_LABELS,
  MEASURING_UNITS,
  MEASURING_UNIT_LABELS,
  MEASURING_UNIT_SHORT,
  formatCurrency,
  formatDate,
  generateBarcode,
} from '../utils/helpers'
import {
  DEMO_INVENTORY_ROWS,
  EXCEL_COLUMNS,
  downloadDemoExcel,
  parseInventorySpreadsheet,
} from '../utils/excel'

const GST_PRESETS = [0, 5, 12, 18, 28]

/* --------------------------- Add / Edit Item Modal -------------------------- */

export function ItemFormModal({ storeId, item, categories, onCategoryCreated, onClose, onSaved }) {
  const isEdit = Boolean(item)
  const [form, setForm] = useState({
    name: item?.name ?? '',
    category: item?.category?.id ?? '',
    barcode: item?.barcode ?? generateBarcode(),
    hsn: item?.hsn ?? '',
    measuringUnit: item?.measuringUnit ?? 'piece',
    purchasePrice: item?.purchasePrice ?? '',
    purchasePriceWithTax: item?.purchasePriceWithTax ?? false,
    salePrice: item?.salePrice ?? '',
    salePriceWithTax: item?.salePriceWithTax ?? false,
    gst: item?.gst ?? 5,
    currentStock: item?.currentStock ?? 0,
    lowStock: item?.lowStock ?? 5,
    remarks: '',
    isActive: item?.isActive ?? true,
  })

  const [newCatMode, setNewCatMode] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: val }))
  }

  const handleQuickCreateCategory = async () => {
    if (newCatName.trim().length < 2) {
      setErrors((prev) => ({ ...prev, category: 'Category name must be at least 2 characters' }))
      return
    }
    setCreatingCat(true)
    setErrors((prev) => ({ ...prev, category: undefined }))
    try {
      const res = await api.post(`/inventory/categories?storeId=${storeId}`, {
        name: newCatName.trim(),
      })
      onCategoryCreated(res.category)
      setForm((f) => ({ ...f, category: res.category.id }))
      setNewCatName('')
      setNewCatMode(false)
    } catch (err) {
      setErrors((prev) => ({ ...prev, category: err.message }))
    } finally {
      setCreatingCat(false)
    }
  }

  const validate = () => {
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Item name must be at least 2 characters'
    if (!form.barcode.trim()) next.barcode = 'Barcode is required'
    if (!form.hsn.trim()) next.hsn = 'HSN code is required'
    if (form.purchasePrice === '' || Number(form.purchasePrice) < 0 || isNaN(Number(form.purchasePrice))) {
      next.purchasePrice = 'Enter a valid purchase price'
    }
    if (form.salePrice === '' || Number(form.salePrice) < 0 || isNaN(Number(form.salePrice))) {
      next.salePrice = 'Enter a valid sale price'
    }
    if (form.gst === '' || Number(form.gst) < 0 || Number(form.gst) > 100 || isNaN(Number(form.gst))) {
      next.gst = 'GST must be between 0 and 100%'
    }
    if (!isEdit && (form.currentStock === '' || Number(form.currentStock) < 0 || isNaN(Number(form.currentStock)))) {
      next.currentStock = 'Opening stock cannot be negative'
    }
    if (form.lowStock === '' || Number(form.lowStock) < 0 || isNaN(Number(form.lowStock))) {
      next.lowStock = 'Low stock alert cannot be negative'
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
          category: form.category || null,
          barcode: form.barcode.trim(),
          hsn: form.hsn.trim(),
          measuringUnit: form.measuringUnit,
          purchasePrice: Number(form.purchasePrice),
          purchasePriceWithTax: Boolean(form.purchasePriceWithTax),
          salePrice: Number(form.salePrice),
          salePriceWithTax: Boolean(form.salePriceWithTax),
          gst: Number(form.gst),
          lowStock: Number(form.lowStock),
          isActive: Boolean(form.isActive),
        }
        const res = await api.patch(`/inventory/items/${item.id}?storeId=${storeId}`, payload)
        onSaved(res.item, 'Item updated successfully')
      } else {
        const payload = {
          name: form.name.trim(),
          ...(form.category ? { category: form.category } : {}),
          barcode: form.barcode.trim(),
          hsn: form.hsn.trim(),
          measuringUnit: form.measuringUnit,
          purchasePrice: Number(form.purchasePrice),
          purchasePriceWithTax: Boolean(form.purchasePriceWithTax),
          salePrice: Number(form.salePrice),
          salePriceWithTax: Boolean(form.salePriceWithTax),
          gst: Number(form.gst),
          currentStock: Number(form.currentStock),
          lowStock: Number(form.lowStock),
          ...(form.remarks.trim() ? { remarks: form.remarks.trim() } : {}),
        }
        const res = await api.post(`/inventory/items?storeId=${storeId}`, payload)
        onSaved(res.item, `Item "${res.item.name}" added and opening ledger recorded`)
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
      title={isEdit ? `Edit Item: ${item.name}` : 'Add New Inventory Item'}
      subtitle={
        isEdit
          ? 'Update item details, pricing, tax settings, and alert thresholds.'
          : 'Add a confectionery item to this facility. An opening stock ledger entry is created automatically.'
      }
      onClose={onClose}
      maxWidth={680}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button id="save-item-btn" type="submit" form="item-form" variant="primary" loading={loading}>
            {isEdit ? 'Save Changes' : 'Add Item to Inventory'}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />

        <div className="form-grid">
          <div className="span-2">
            <TextField
              id="item-name"
              label="Item Name *"
              placeholder="e.g. Belgian Dark Chocolate Truffle Box (500g)"
              icon={<IconBox size={18} />}
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />
          </div>

          {/* Category selector with inline quick create */}
          <div className="span-2">
            <Field label="Category" error={errors.category} htmlFor="item-category">
              {!newCatMode ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    id="item-category"
                    className="input"
                    value={form.category}
                    onChange={set('category')}
                  >
                    <option value="">— Uncategorized —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setNewCatMode(true)}
                  >
                    <IconPlus size={16} /> New Category
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="New category name (e.g. Chocolates, Pastries)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={creatingCat}
                    onClick={handleQuickCreateCategory}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewCatMode(false)
                      setNewCatName('')
                      setErrors((prev) => ({ ...prev, category: undefined }))
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </Field>
          </div>

          {/* Barcode & HSN */}
          <Field label="Barcode *" error={errors.barcode} htmlFor="item-barcode">
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="input-wrap" style={{ flex: 1 }}>
                <span className="lead">
                  <IconBarcode size={18} />
                </span>
                <input
                  id="item-barcode"
                  className={`input${errors.barcode ? ' invalid' : ''}`}
                  placeholder="890123456789"
                  value={form.barcode}
                  onChange={set('barcode')}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Generate random barcode"
                onClick={() => setForm((f) => ({ ...f, barcode: generateBarcode() }))}
              >
                <IconRefresh size={15} />
              </Button>
            </div>
          </Field>

          <TextField
            id="item-hsn"
            label="HSN Code *"
            placeholder="e.g. 1806 / 1905"
            icon={<IconTag size={18} />}
            value={form.hsn}
            onChange={set('hsn')}
            error={errors.hsn}
          />

          {/* Measuring Unit & GST */}
          <Field label="Measuring Unit *" htmlFor="item-unit">
            <select
              id="item-unit"
              className="input"
              value={form.measuringUnit}
              onChange={set('measuringUnit')}
            >
              {MEASURING_UNITS.map((u) => (
                <option key={u} value={u}>
                  {MEASURING_UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="GST Rate (%) *" error={errors.gst} htmlFor="item-gst">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                id="item-gst"
                type="number"
                min="0"
                max="100"
                step="0.5"
                className={`input${errors.gst ? ' invalid' : ''}`}
                value={form.gst}
                onChange={set('gst')}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GST_PRESETS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    className={`chip${Number(form.gst) === rate ? ' chip-active' : ''}`}
                    style={{
                      padding: '2px 9px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      background: Number(form.gst) === rate ? 'var(--rose-500)' : undefined,
                      color: Number(form.gst) === rate ? '#fff' : undefined,
                      borderColor: Number(form.gst) === rate ? 'var(--rose-500)' : undefined,
                    }}
                    onClick={() => setForm((f) => ({ ...f, gst: rate }))}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </div>
          </Field>

          {/* Purchase Price & Tax Inclusive toggle */}
          <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--cream-50)' }}>
            <TextField
              id="item-purchase-price"
              label={`Purchase Price (₹ per ${MEASURING_UNIT_SHORT[form.measuringUnit]}) *`}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.purchasePrice}
              onChange={set('purchasePrice')}
              error={errors.purchasePrice}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer', color: 'var(--ink-700)' }}>
              <input
                type="checkbox"
                checked={form.purchasePriceWithTax}
                onChange={set('purchasePriceWithTax')}
              />
              Purchase price includes GST ({form.gst || 0}%)
            </label>
          </div>

          {/* Sale Price & Tax Inclusive toggle */}
          <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--cream-50)' }}>
            <TextField
              id="item-sale-price"
              label={`Sale Price (₹ per ${MEASURING_UNIT_SHORT[form.measuringUnit]}) *`}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.salePrice}
              onChange={set('salePrice')}
              error={errors.salePrice}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer', color: 'var(--ink-700)' }}>
              <input
                type="checkbox"
                checked={form.salePriceWithTax}
                onChange={set('salePriceWithTax')}
              />
              Sale price includes GST ({form.gst || 0}%)
            </label>
          </div>

          {/* Opening Stock & Low Stock Alert */}
          {!isEdit ? (
            <TextField
              id="item-opening-stock"
              label={`Opening Stock (${MEASURING_UNIT_SHORT[form.measuringUnit]})`}
              type="number"
              min="0"
              step="any"
              value={form.currentStock}
              onChange={set('currentStock')}
              error={errors.currentStock}
              hint="Recorded in ledger as Opening Stock"
            />
          ) : (
            <Field label="Current Stock">
              <div
                className="input"
                style={{ background: 'var(--cream-100)', color: 'var(--ink-700)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <strong>
                  {item.currentStock} {MEASURING_UNIT_SHORT[item.measuringUnit]}
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-500)' }}>
                  Use "Adjust Stock" to change
                </span>
              </div>
            </Field>
          )}

          <TextField
            id="item-low-stock"
            label={`Low Stock Alert (${MEASURING_UNIT_SHORT[form.measuringUnit]})`}
            type="number"
            min="0"
            step="any"
            value={form.lowStock}
            onChange={set('lowStock')}
            error={errors.lowStock}
            hint="Highlights item when stock falls to or below this level"
          />

          {!isEdit && (
            <div className="span-2">
              <TextField
                id="item-remarks"
                label="Opening Ledger Remarks (optional)"
                placeholder="e.g. Initial physical inventory count"
                value={form.remarks}
                onChange={set('remarks')}
              />
            </div>
          )}

          {isEdit && (
            <div className="span-2">
              <div className="perm-item">
                <div>
                  <strong>Item Active Status</strong>
                  <small>Inactive items are hidden from active POS billing</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={set('isActive')}
                    aria-label="Item Active Status"
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

/* ---------------------------- Adjust Stock Modal --------------------------- */

export function AdjustStockModal({ storeId, item, onClose, onSaved }) {
  const [mode, setMode] = useState('add')
  const [quantity, setQuantity] = useState('')
  const [rate, setRate] = useState(item.purchasePrice ?? 0)
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  const unitShort = MEASURING_UNIT_SHORT[item.measuringUnit] || item.measuringUnit
  const numQty = Number(quantity) || 0

  let projectedStock = item.currentStock
  if (mode === 'add') projectedStock = Number((item.currentStock + numQty).toFixed(4))
  else if (mode === 'reduce') projectedStock = Number((item.currentStock - numQty).toFixed(4))
  else projectedStock = Number(numQty.toFixed(4))

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    if (quantity === '' || isNaN(Number(quantity))) {
      return setError('Enter a valid quantity')
    }
    if ((mode === 'add' || mode === 'reduce') && numQty <= 0) {
      return setError('Quantity must be greater than 0')
    }
    if (projectedStock < 0) {
      return setError(`Resulting stock cannot be negative (${projectedStock} ${unitShort})`)
    }
    if (projectedStock === item.currentStock) {
      return setError('Stock is already at this quantity')
    }
    setError('')

    setLoading(true)
    try {
      const res = await api.post(`/inventory/items/${item.id}/adjust-stock?storeId=${storeId}`, {
        mode,
        quantity: numQty,
        rate: Number(rate) || 0,
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      })
      onSaved(res.item, `Stock updated for "${item.name}" (New stock: ${res.item.currentStock} ${unitShort})`)
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Adjust Inventory Stock"
      subtitle={`${item.name} (${item.barcode})`}
      onClose={onClose}
      maxWidth={500}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button id="submit-stock-adjust" type="submit" form="adjust-stock-form" variant="primary" loading={loading}>
            Confirm & Post to Ledger
          </Button>
        </>
      }
    >
      <form id="adjust-stock-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />

        <div className="tabs" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 18 }}>
          <button
            type="button"
            className={mode === 'add' ? 'active' : ''}
            onClick={() => {
              setMode('add')
              setError('')
            }}
          >
            + Add Stock
          </button>
          <button
            type="button"
            className={mode === 'reduce' ? 'active' : ''}
            onClick={() => {
              setMode('reduce')
              setError('')
            }}
          >
            − Reduce Stock
          </button>
          <button
            type="button"
            className={mode === 'set' ? 'active' : ''}
            onClick={() => {
              setMode('set')
              setError('')
            }}
          >
            = Set Exact
          </button>
        </div>

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
            <small className="muted">Current Stock</small>
            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              {item.currentStock} {unitShort}
            </div>
          </div>
          <div style={{ fontSize: '1.3rem', color: 'var(--ink-500)' }}>→</div>
          <div style={{ textAlign: 'right' }}>
            <small className="muted">Projected Closing Stock</small>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: projectedStock < 0 ? 'var(--red-500)' : 'var(--green-500)',
              }}
            >
              {projectedStock} {unitShort}
            </div>
          </div>
        </div>

        <div className="form-grid">
          <TextField
            id="adj-quantity"
            label={
              mode === 'add'
                ? `Quantity to Add (${unitShort}) *`
                : mode === 'reduce'
                ? `Quantity to Reduce (${unitShort}) *`
                : `New Total Stock (${unitShort}) *`
            }
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={error}
            autoFocus
          />

          <TextField
            id="adj-rate"
            label={`Valuation Rate (₹ / ${unitShort})`}
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />

          <div className="span-2">
            <TextField
              id="adj-remarks"
              label="Ledger Remarks"
              placeholder="e.g. Fresh kitchen batch added / Damaged pieces write-off"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}

/* ----------------------------- Item Ledger Modal --------------------------- */

export function ItemLedgerModal({ storeId, item, canAdjust, onAdjustClick, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ type: '', fromDate: '', toDate: '', page: 1, limit: 25 })

  const unitShort = MEASURING_UNIT_SHORT[item.measuringUnit] || item.measuringUnit

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

      const res = await api.get(`/inventory/items/${item.id}/ledger?${params.toString()}`)
      setData(res)
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [storeId, item.id, filters])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  return (
    <Modal
      title={`Item Ledger: ${item.name}`}
      subtitle={`Barcode: ${item.barcode} · HSN: ${item.hsn} · Unit: ${MEASURING_UNIT_LABELS[item.measuringUnit]}`}
      onClose={onClose}
      maxWidth={920}
      footer={
        <>
          {canAdjust && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onClose()
                onAdjustClick(item)
              }}
            >
              <IconLayers size={16} /> Adjust Stock
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {/* Item Summary Banner */}
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
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.78rem', color: '#cbb8d3', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Current Closing Stock
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {item.currentStock} {unitShort}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', color: '#cbb8d3' }}>Low Stock Alert</div>
          <div style={{ fontWeight: 600 }}>
            {item.lowStock} {unitShort}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', color: '#cbb8d3' }}>Purchase Price</div>
          <div style={{ fontWeight: 600 }}>
            {formatCurrency(item.purchasePrice)} {item.purchasePriceWithTax ? '(Incl. GST)' : '(+GST)'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', color: '#cbb8d3' }}>Sale Price</div>
          <div style={{ fontWeight: 600 }}>
            {formatCurrency(item.salePrice)} {item.salePriceWithTax ? '(Incl. GST)' : '(+GST)'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', color: '#cbb8d3' }}>Stock Valuation</div>
          <div style={{ fontWeight: 700, color: 'var(--caramel-500)' }}>
            {formatCurrency(Math.max(0, item.currentStock) * item.purchasePrice)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <select
          className="input"
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
          aria-label="Filter ledger by transaction type"
        >
          <option value="">All Movement Types</option>
          <option value="add_new_item">Opening Stock</option>
          <option value="stock_adjustment">Stock Adjustment</option>
          <option value="purchase_item">Purchase In</option>
          <option value="sale_item">Sale Out</option>
          <option value="sale_item_return">Sales Return</option>
          <option value="purchase_item_return">Purchase Return</option>
          <option value="cancel_sale_invoice_item">Cancelled Sale</option>
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

      <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
        <table style={{ minWidth: 680 }}>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Type</th>
              <th>Stock In (+Dr)</th>
              <th>Stock Out (-Cr)</th>
              <th>Closing Stock</th>
              <th>Rate / Value</th>
              <th>Remarks & By</th>
            </tr>
          </thead>
          <tbody>
            {!data &&
              [1, 2, 3].map((i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                    <td key={c}>
                      <div className="skeleton" />
                    </td>
                  ))}
                </tr>
              ))}
            {data && data.entries.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty" style={{ padding: '28px 12px' }}>
                    No ledger movements match your filters.
                  </div>
                </td>
              </tr>
            )}
            {data?.entries.map((entry) => (
              <tr key={entry.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.84rem', color: 'var(--ink-700)' }}>
                  {formatDate(entry.date)}
                </td>
                <td>
                  <span
                    className={`badge ${
                      entry.debit > 0 ? 'on' : entry.credit > 0 ? 'purchase' : ''
                    }`}
                  >
                    {LEDGER_TYPE_LABELS[entry.type] ?? entry.type}
                  </span>
                </td>
                <td style={{ fontWeight: 700, color: entry.debit > 0 ? 'var(--green-500)' : 'var(--ink-300)' }}>
                  {entry.debit > 0 ? `+${entry.debit} ${unitShort}` : '—'}
                </td>
                <td style={{ fontWeight: 700, color: entry.credit > 0 ? 'var(--red-500)' : 'var(--ink-300)' }}>
                  {entry.credit > 0 ? `-${entry.credit} ${unitShort}` : '—'}
                </td>
                <td>
                  <span className="code-pill" style={{ background: 'var(--plum-700)' }}>
                    {entry.closingStock} {unitShort}
                  </span>
                </td>
                <td style={{ fontSize: '0.84rem' }}>
                  <div>{formatCurrency(entry.rate)} / {unitShort}</div>
                  <small className="muted">{formatCurrency(entry.amount)}</small>
                </td>
                <td style={{ fontSize: '0.84rem', maxWidth: 220 }}>
                  <div>{entry.remarks || '—'}</div>
                  {entry.user && (
                    <small className="muted">by {entry.user.userName}</small>
                  )}
                </td>
              </tr>
            ))}
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

/* ------------------------ Bulk Excel Upload Modal ------------------------- */

export function BulkUploadModal({ storeId, onClose, onImported }) {
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
      const res = await parseInventorySpreadsheet(file)
      setParsed(res)
    } catch (err) {
      setParsed(null)
      setParseError(err.message || 'Could not parse the selected Excel sheet')
    }
  }

  const handleLoadDemoIntoPreview = () => {
    setParseError('')
    setServerError(null)
    setResult(null)
    setFileName('AMStore_Inventory_Demo.xlsx (Demo Data)')
    const rows = DEMO_INVENTORY_ROWS.map((r, i) => ({
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
        items: parsed.validRows.map((r) => ({
          rowNumber: r.rowNumber,
          name: r.name,
          ...(r.category ? { category: r.category } : {}),
          barcode: r.barcode,
          hsn: r.hsn,
          measuringUnit: r.measuringUnit,
          purchasePrice: r.purchasePrice,
          purchasePriceWithTax: r.purchasePriceWithTax,
          salePrice: r.salePrice,
          salePriceWithTax: r.salePriceWithTax,
          gst: r.gst,
          currentStock: r.currentStock,
          lowStock: r.lowStock,
          ...(r.remarks ? { remarks: r.remarks } : {}),
        })),
      }
      const res = await api.post(`/inventory/items/bulk?storeId=${storeId}`, payload)
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
      title="Bulk Add Inventory via Excel Sheet"
      subtitle="Upload an Excel (.xlsx) or CSV sheet to add multiple confectionery items and record their opening stock ledgers at once."
      onClose={onClose}
      maxWidth={960}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && parsed?.validRows?.length > 0 && (
            <Button
              id="confirm-bulk-import-btn"
              variant="primary"
              loading={importing}
              onClick={handleImport}
            >
              <IconUpload size={16} /> Import {parsed.validRows.length} Valid{' '}
              {parsed.validRows.length === 1 ? 'Item' : 'Items'}
            </Button>
          )}
        </>
      }
    >
      {/* Top Demo Sheet Download Banner */}
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
            <IconSheet size={18} /> Need the Excel Template?
          </strong>
          <small style={{ color: '#d9c9e0' }}>
            Download the pre-formatted demo sheet with all 13 columns and sample confectionery items.
          </small>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            id="download-demo-xlsx-btn"
            size="sm"
            variant="primary"
            type="button"
            onClick={() => downloadDemoExcel('xlsx')}
          >
            <IconDownload size={15} /> Download Demo Excel (.xlsx)
          </Button>
          <Button
            id="download-demo-csv-btn"
            size="sm"
            type="button"
            style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
            onClick={() => downloadDemoExcel('csv')}
          >
            <IconDownload size={15} /> Demo CSV (.csv)
          </Button>
        </div>
      </div>

      {/* View Switcher inside Modal */}
      <div className="tabs" style={{ maxWidth: 460, marginBottom: 16 }} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={tab === 'upload' ? 'active' : ''}
          onClick={() => setTab('upload')}
        >
          1. Upload & Preview Sheet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'guide'}
          className={tab === 'guide' ? 'active' : ''}
          onClick={() => setTab('guide')}
        >
          2. Excel Columns & Demo Sheet
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
            Imported {result.importedCount} item(s) into inventory
            {result.createdCategoriesCount > 0
              ? ` (auto-created ${result.createdCategoriesCount} new ${
                  result.createdCategoriesCount === 1 ? 'category' : 'categories'
                })`
              : ''}
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
              <strong>Excel Sheet Columns (Row 1 Header):</strong>
              <button
                type="button"
                className="link-btn"
                style={{ fontSize: '0.82rem' }}
                onClick={() => setTab('guide')}
              >
                View full column specs & demo table →
              </button>
            </div>
            <div className="chips" style={{ marginTop: 4 }}>
              {EXCEL_COLUMNS.map((c) => (
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
              accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
            <IconUpload size={28} style={{ color: 'var(--rose-500)', marginBottom: 8 }} />
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>
              {fileName ? `Selected: ${fileName}` : 'Click to select or drag & drop your Excel (.xlsx) or CSV file'}
            </div>
            <p className="muted" style={{ marginTop: 4, fontSize: '0.84rem' }}>
              Supports Microsoft Excel (.xlsx) and CSV (.csv) up to 10,000 items per upload.
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
                Choose File
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={handleLoadDemoIntoPreview}
              >
                Load Demo Sheet into Preview
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
                  Sheet Preview: {parsed.rows.length} rows detected (
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
                <table style={{ minWidth: 880 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th>Row</th>
                      <th>Status</th>
                      <th>name</th>
                      <th>category</th>
                      <th>barcode</th>
                      <th>hsn</th>
                      <th>measuringUnit</th>
                      <th>purchasePrice</th>
                      <th>salePrice</th>
                      <th>gst</th>
                      <th>currentStock</th>
                      <th>lowStock</th>
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
                            <span
                              className="badge purchase"
                              title={r.errors.join('; ')}
                            >
                              {r.errors[0]}
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>{r.name || '—'}</strong>
                        </td>
                        <td>{r.category || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.barcode}</td>
                        <td>{r.hsn || '—'}</td>
                        <td>{r.measuringUnit}</td>
                        <td>
                          {formatCurrency(r.purchasePrice)}
                          <small className="muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                            {r.purchasePriceWithTax ? 'Incl. GST' : 'Excl. GST'}
                          </small>
                        </td>
                        <td>
                          {formatCurrency(r.salePrice)}
                          <small className="muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                            {r.salePriceWithTax ? 'Incl. GST' : 'Excl. GST'}
                          </small>
                        </td>
                        <td>{r.gst}%</td>
                        <td>{r.currentStock}</td>
                        <td>{r.lowStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length > 100 && (
                <p className="muted" style={{ marginTop: 8, fontSize: '0.82rem' }}>
                  Showing first 100 of {parsed.rows.length} rows in preview. All {parsed.validRows.length} valid rows will be imported.
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
              Excel Sheet Column Specifications
            </h3>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
              Use these exact column names in the first row (header row) of your Excel sheet. Columns marked Required must be filled for every row.
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
                  {EXCEL_COLUMNS.map((col) => (
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

          {/* Demo Sheet Live Table Preview */}
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
                <h3 style={{ fontSize: '1rem' }}>Demo Excel Sheet Preview (Sample Rows)</h3>
                <p className="muted" style={{ fontSize: '0.84rem' }}>
                  This is the exact structure inside the downloadable Demo Excel (.xlsx) sheet.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={handleLoadDemoIntoPreview}
                >
                  Load Demo into Importer
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="button"
                  onClick={() => downloadDemoExcel('xlsx')}
                >
                  <IconDownload size={14} /> Download .xlsx
                </Button>
              </div>
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 960, fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    {EXCEL_COLUMNS.map((c) => (
                      <th key={c.key} style={{ textTransform: 'none', fontFamily: 'monospace' }}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO_INVENTORY_ROWS.map((row, idx) => (
                    <tr key={idx}>
                      {EXCEL_COLUMNS.map((c) => (
                        <td key={c.key}>
                          {typeof row[c.key] === 'boolean'
                            ? row[c.key]
                              ? 'TRUE'
                              : 'FALSE'
                            : String(row[c.key] ?? '')}
                        </td>
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


