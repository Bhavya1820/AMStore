import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, ErrorAlert } from '../components/ui'
import {
  IconAlert,
  IconBox,
  IconEdit,
  IconLayers,
  IconLedger,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSheet,
  IconStore,
  IconTag,
} from '../components/Icons'
import {
  AdjustStockModal,
  BulkUploadModal,
  ItemFormModal,
  ItemLedgerModal,
} from '../components/InventoryModals'
import {
  MEASURING_UNITS,
  MEASURING_UNIT_LABELS,
  MEASURING_UNIT_SHORT,
  formatCurrency,
} from '../utils/helpers'

const ROW_HEIGHT = 68
const VIEWPORT_HEIGHT = 540
const OVERSCAN = 6

/* ----------------------- Virtualized Inventory Table ----------------------- */

function VirtualizedItemsTable({
  items,
  loading,
  canManage,
  canAdjust,
  onOpenLedger,
  onAdjustStock,
  onEditItem,
}) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)

  const totalCount = items.length
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT)
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(totalCount, startIndex + visibleCount + OVERSCAN * 2)

  const topSpacerHeight = startIndex * ROW_HEIGHT
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT)
  const visibleItems = items.slice(startIndex, endIndex)

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
      <table style={{ minWidth: 920 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr>
            <th>Item & Barcode</th>
            <th>Category</th>
            <th>HSN / GST</th>
            <th>Purchase Price</th>
            <th>Sale Price</th>
            <th>Current Stock</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading &&
            [1, 2, 3, 4, 5, 6].map((i) => (
              <tr key={i} style={{ height: ROW_HEIGHT }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                  <td key={c}>
                    <div className="skeleton" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && totalCount === 0 && (
            <tr>
              <td colSpan={8}>
                <div className="empty">
                  No inventory items found matching your filters. Add your first item or upload an Excel sheet to get started.
                </div>
              </td>
            </tr>
          )}

          {!loading && totalCount > 0 && (
            <>
              {topSpacerHeight > 0 && (
                <tr aria-hidden="true" style={{ height: topSpacerHeight }}>
                  <td colSpan={8} style={{ padding: 0, border: 0 }} />
                </tr>
              )}

              {visibleItems.map((item) => {
                const unitShort = MEASURING_UNIT_SHORT[item.measuringUnit] || item.measuringUnit
                const isOut = item.currentStock <= 0
                const isLow = !isOut && item.currentStock <= item.lowStock

                return (
                  <tr
                    key={item.id}
                    id={`item-row-${item.id}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--ink-900)' }}>
                          {item.name}
                        </strong>
                        <small style={{ color: 'var(--ink-500)', fontFamily: 'ui-monospace, Consolas, monospace' }}>
                          {item.barcode}
                        </small>
                      </div>
                    </td>

                    <td>
                      {item.category?.name ? (
                        <span className="chip" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                          {item.category.name}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.82rem' }}>—</span>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: '0.88rem' }}>HSN: <strong>{item.hsn}</strong></div>
                      <small style={{ color: 'var(--ink-500)' }}>GST {item.gst}%</small>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600 }}>{formatCurrency(item.purchasePrice)}</div>
                      <small style={{ color: 'var(--ink-500)', fontSize: '0.76rem' }}>
                        {item.purchasePriceWithTax ? 'Incl. Tax' : 'Excl. Tax'} / {unitShort}
                      </small>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--plum-700)' }}>
                        {formatCurrency(item.salePrice)}
                      </div>
                      <small style={{ color: 'var(--ink-500)', fontSize: '0.76rem' }}>
                        {item.salePriceWithTax ? 'Incl. Tax' : 'Excl. Tax'} / {unitShort}
                      </small>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className={`badge ${
                            isOut ? 'purchase' : isLow ? 'owner' : 'on'
                          }`}
                          style={{ fontSize: '0.84rem', padding: '5px 11px', cursor: 'pointer' }}
                          title="Click to view this item's ledger"
                          onClick={() => onOpenLedger(item)}
                        >
                          {item.currentStock} {unitShort}
                        </span>
                      </div>
                      <small style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>
                        Low alert: ≤ {item.lowStock} {unitShort}
                      </small>
                    </td>

                    <td>
                      {isOut ? (
                        <span className="badge purchase">Out of Stock</span>
                      ) : isLow ? (
                        <span className="badge owner">Low Stock</span>
                      ) : (
                        <span className={`badge ${item.isActive ? 'on' : 'off'}`}>
                          {item.isActive ? 'In Stock' : 'Inactive'}
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="row-actions" style={{ gap: 6 }}>
                        <Button
                          id={`ledger-btn-${item.id}`}
                          size="sm"
                          variant="ghost"
                          title="View Item Stock Ledger"
                          onClick={() => onOpenLedger(item)}
                        >
                          <IconLedger size={15} /> Ledger
                        </Button>
                        {canAdjust && (
                          <button
                            className="btn-icon"
                            title="Adjust Stock"
                            aria-label={`Adjust stock for ${item.name}`}
                            onClick={() => onAdjustStock(item)}
                          >
                            <IconLayers size={17} />
                          </button>
                        )}
                        {canManage && (
                          <button
                            className="btn-icon"
                            title="Edit Item"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => onEditItem(item)}
                          >
                            <IconEdit size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {bottomSpacerHeight > 0 && (
                <tr aria-hidden="true" style={{ height: bottomSpacerHeight }}>
                  <td colSpan={8} style={{ padding: 0, border: 0 }} />
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
          Showing <strong>{start}–{end}</strong> of <strong>{total}</strong>
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
              className="input"
              style={{ width: 'auto', padding: '5px 10px', fontSize: '0.85rem' }}
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {[25, 50, 100, 250, 500].map((n) => (
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

export default function Inventory() {
  const { has } = useAuth()
  const toast = useToast()

  const canManage = has('item:manage')
  const canAdjust = has('item:manage') || has('stock:adjust')

  // Facility / Store state
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [categories, setCategories] = useState([])

  // Items state & filters
  const [itemsData, setItemsData] = useState(null)
  const [loadingItems, setLoadingItems] = useState(true)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({
    q: '',
    category: '',
    measuringUnit: '',
    stockStatus: 'all',
    isActive: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 50,
  })

  // Modal state: { type: 'add' | 'bulk' | 'edit' | 'adjust' | 'ledger', item?: object }
  const [modal, setModal] = useState(null)

  // Load user's accessible stores on mount
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

  // Debounce search box into filters.q
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput, page: 1 }))
    }, 280)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Load categories whenever selectedStoreId changes
  const loadCategories = useCallback(async () => {
    if (!selectedStoreId) return
    try {
      const res = await api.get(`/inventory/categories?storeId=${selectedStoreId}`)
      setCategories(res.categories)
    } catch {
      setCategories([])
    }
  }, [selectedStoreId])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // Load paginated & filtered inventory items
  const loadItems = useCallback(async () => {
    if (!selectedStoreId) return
    setLoadingItems(true)
    try {
      const params = new URLSearchParams({
        storeId: selectedStoreId,
        stockStatus: filters.stockStatus,
        isActive: filters.isActive,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: String(filters.page),
        limit: String(filters.limit),
      })
      if (filters.q.trim()) params.set('q', filters.q.trim())
      if (filters.category) params.set('category', filters.category)
      if (filters.measuringUnit) params.set('measuringUnit', filters.measuringUnit)

      const res = await api.get(`/inventory/items?${params.toString()}`)
      setItemsData(res)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoadingItems(false)
    }
  }, [selectedStoreId, filters])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const currentStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId),
    [stores, selectedStoreId]
  )

  const summary = itemsData?.summary

  const handleSortChange = (value) => {
    const [sortBy, sortOrder] = value.split(':')
    setFilters((f) => ({ ...f, sortBy, sortOrder, page: 1 }))
  }

  const resetFilters = () => {
    setSearchInput('')
    setFilters({
      q: '',
      category: '',
      measuringUnit: '',
      stockStatus: 'all',
      isActive: 'all',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: 1,
      limit: filters.limit,
    })
  }

  const hasActiveFilters =
    Boolean(searchInput) ||
    Boolean(filters.category) ||
    Boolean(filters.measuringUnit) ||
    filters.stockStatus !== 'all' ||
    filters.isActive !== 'all'

  return (
    <>
      {/* Header Bar with Facility Selector & Actions */}
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
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Inventory Items</h2>
          <p className="muted">
            Manage confectionery stock, pricing, GST, and click <strong>Ledger</strong> on any item to inspect its stock history.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {stores.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconStore size={18} style={{ color: 'var(--rose-500)' }} />
              <select
                id="inventory-store-select"
                className="input"
                style={{ width: 'auto', minWidth: 210, fontWeight: 600 }}
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value)
                  setFilters((f) => ({ ...f, category: '', page: 1 }))
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

          {canManage && (
            <>
              <Button
                id="bulk-upload-inventory-btn"
                variant="ghost"
                disabled={!selectedStoreId}
                onClick={() => setModal({ type: 'bulk' })}
              >
                <IconSheet size={18} /> Bulk Upload (Excel)
              </Button>
              <Button
                id="add-inventory-item-btn"
                variant="primary"
                disabled={!selectedStoreId}
                onClick={() => setModal({ type: 'add' })}
              >
                <IconPlus size={18} /> Add Inventory Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid-stats" aria-label="Inventory summary">
        <div
          className="card stat"
          style={{ cursor: 'pointer' }}
          onClick={() => setFilters((f) => ({ ...f, stockStatus: 'all', page: 1 }))}
        >
          <div className="ico">
            <IconBox />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 50, height: 28 }} />
            ) : (
              <div className="num">{summary.totalItems}</div>
            )}
            <div className="lbl">
              Total Items {summary ? `(${summary.activeItems} active)` : ''}
            </div>
          </div>
        </div>

        <div
          className="card stat"
          style={{
            cursor: 'pointer',
            borderColor: filters.stockStatus === 'low' ? 'var(--amber-500)' : undefined,
          }}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              stockStatus: f.stockStatus === 'low' ? 'all' : 'low',
              page: 1,
            }))
          }
        >
          <div
            className="ico"
            style={{ background: 'linear-gradient(135deg, #e9a23b, #f5c46a)' }}
          >
            <IconAlert />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 50, height: 28 }} />
            ) : (
              <div className="num">{summary.lowStockCount}</div>
            )}
            <div className="lbl">Low Stock Alerts</div>
          </div>
        </div>

        <div
          className="card stat"
          style={{
            cursor: 'pointer',
            borderColor: filters.stockStatus === 'out' ? 'var(--red-500)' : undefined,
          }}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              stockStatus: f.stockStatus === 'out' ? 'all' : 'out',
              page: 1,
            }))
          }
        >
          <div
            className="ico"
            style={{ background: 'linear-gradient(135deg, #e5484d, #f27c9d)' }}
          >
            <IconAlert />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 50, height: 28 }} />
            ) : (
              <div className="num">{summary.outOfStockCount}</div>
            )}
            <div className="lbl">Out of Stock</div>
          </div>
        </div>

        <div className="card stat">
          <div
            className="ico"
            style={{ background: 'linear-gradient(135deg, #2fb38a, #5fd3a8)' }}
          >
            <IconTag />
          </div>
          <div>
            {summary === undefined ? (
              <div className="skeleton" style={{ width: 90, height: 28 }} />
            ) : (
              <div className="num" style={{ fontSize: '1.35rem' }}>
                {formatCurrency(summary.totalStockValue)}
              </div>
            )}
            <div className="lbl">
              Stock Value {summary ? `(Retail: ${formatCurrency(summary.totalRetailValue)})` : ''}
            </div>
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
            id="inventory-search"
            className="input"
            placeholder="Search by item name, barcode, or HSN code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search inventory items"
          />
        </div>

        <select
          id="filter-category"
          className="input"
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          <option value="uncategorized">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.itemCount})
            </option>
          ))}
        </select>

        <select
          id="filter-unit"
          className="input"
          value={filters.measuringUnit}
          onChange={(e) => setFilters((f) => ({ ...f, measuringUnit: e.target.value, page: 1 }))}
          aria-label="Filter by measuring unit"
        >
          <option value="">All Units</option>
          {MEASURING_UNITS.map((u) => (
            <option key={u} value={u}>
              {MEASURING_UNIT_LABELS[u]}
            </option>
          ))}
        </select>

        <select
          id="filter-stock-status"
          className="input"
          value={filters.stockStatus}
          onChange={(e) => setFilters((f) => ({ ...f, stockStatus: e.target.value, page: 1 }))}
          aria-label="Filter by stock status"
        >
          <option value="all">All Stock Levels</option>
          <option value="in">In Stock</option>
          <option value="low">Low Stock Alert</option>
          <option value="out">Out of Stock</option>
        </select>

        <select
          id="filter-sort"
          className="input"
          value={`${filters.sortBy}:${filters.sortOrder}`}
          onChange={(e) => handleSortChange(e.target.value)}
          aria-label="Sort items"
        >
          <option value="createdAt:desc">Newest First</option>
          <option value="name:asc">Name (A → Z)</option>
          <option value="name:desc">Name (Z → A)</option>
          <option value="currentStock:asc">Stock (Low → High)</option>
          <option value="currentStock:desc">Stock (High → Low)</option>
          <option value="salePrice:desc">Sale Price (High → Low)</option>
          <option value="purchasePrice:desc">Purchase Price (High → Low)</option>
        </select>

        {hasActiveFilters && (
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            Clear Filters
          </Button>
        )}

        <button
          className="btn-icon"
          title="Refresh inventory"
          aria-label="Refresh inventory"
          onClick={() => {
            loadItems()
            loadCategories()
          }}
        >
          <IconRefresh size={18} />
        </button>
      </div>

      {/* Virtualized Items Table */}
      <VirtualizedItemsTable
        items={itemsData?.items ?? []}
        loading={loadingItems}
        canManage={canManage}
        canAdjust={canAdjust}
        onOpenLedger={(item) => setModal({ type: 'ledger', item })}
        onAdjustStock={(item) => setModal({ type: 'adjust', item })}
        onEditItem={(item) => setModal({ type: 'edit', item })}
      />

      {itemsData && (
        <PaginationBar
          page={itemsData.page}
          totalPages={itemsData.totalPages}
          total={itemsData.total}
          limit={filters.limit}
          renderedCount={Math.min(
            itemsData.items.length,
            Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2
          )}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
        />
      )}

      {/* ============================= MODALS ============================= */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <ItemFormModal
          storeId={selectedStoreId}
          item={modal.type === 'edit' ? modal.item : null}
          categories={categories}
          onCategoryCreated={(cat) =>
            setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
          }
          onClose={() => setModal(null)}
          onSaved={(_savedItem, msg) => {
            toast.success(msg)
            loadItems()
            loadCategories()
          }}
        />
      )}

      {modal?.type === 'bulk' && (
        <BulkUploadModal
          storeId={selectedStoreId}
          onClose={() => setModal(null)}
          onImported={(res) => {
            toast.success(`Imported ${res.importedCount} item(s) into inventory`)
            loadItems()
            loadCategories()
          }}
        />
      )}

      {modal?.type === 'adjust' && (
        <AdjustStockModal
          storeId={selectedStoreId}
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={(_savedItem, msg) => {
            toast.success(msg)
            loadItems()
          }}
        />
      )}

      {modal?.type === 'ledger' && (
        <ItemLedgerModal
          storeId={selectedStoreId}
          item={modal.item}
          canAdjust={canAdjust}
          onAdjustClick={(it) => setModal({ type: 'adjust', item: it })}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
