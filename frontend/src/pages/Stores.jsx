import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, CopyButton, ErrorAlert, Modal, TextField } from '../components/ui'
import { IconBuilding, IconMail, IconMapPin, IconPhone, IconPlus, IconStore } from '../components/Icons'
import { isEmail } from '../utils/helpers'

export default function Stores() {
  const { has } = useAuth()
  const toast = useToast()
  const [stores, setStores] = useState(null)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [createdStore, setCreatedStore] = useState(null)

  const canManage = has('store:manage')

  const loadStores = async () => {
    try {
      const data = await api.get('/stores')
      setStores(data.stores)
      setError(null)
    } catch (err) {
      setError(err)
      setStores([])
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>All Facilities</h2>
          <p className="muted">Manage and monitor all your confectionery store branches.</p>
        </div>
        {canManage && (
          <Button id="add-facility-btn" variant="primary" onClick={() => setModalOpen(true)}>
            <IconPlus size={18} /> Add Facility
          </Button>
        )}
      </div>

      <ErrorAlert error={error} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px', marginTop: '16px' }}>
        {stores === null &&
          [1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ height: '170px' }}>
              <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '14px' }} />
              <div className="skeleton" style={{ height: '16px', width: '80%', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '16px', width: '40%' }} />
            </div>
          ))}

        {stores !== null && stores.length === 0 && (
          <div className="card empty" style={{ gridColumn: '1 / -1' }}>
            No facilities found. Create your first facility.
          </div>
        )}

        {stores?.map((s) => (
          <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconStore size={20} style={{ color: 'var(--rose-500)' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{s.name}</h3>
                </div>
                <span className="code-pill" style={{ display: 'inline-block', marginTop: '8px' }}>
                  {s.storeCode}
                </span>
              </div>
              <span className={`badge ${s.isActive !== false ? 'on' : 'off'}`}>
                {s.isActive !== false ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--cream-100)', paddingTop: '10px', fontSize: '0.9rem', color: 'var(--ink-700)', display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconMail size={16} style={{ color: 'var(--ink-500)', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</span>
              </div>
              {s.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconPhone size={16} style={{ color: 'var(--ink-500)', flexShrink: 0 }} />
                  <span>{s.phone}</span>
                </div>
              )}
              {s.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconMapPin size={16} style={{ color: 'var(--ink-500)', flexShrink: 0 }} />
                  <span>{s.address}</span>
                </div>
              )}
              {s.gstIn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink-500)' }}>GSTIN:</span>
                  <span style={{ fontFamily: 'monospace' }}>{s.gstIn}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <CreateStoreModal
          onClose={() => setModalOpen(false)}
          onSuccess={(store) => {
            setCreatedStore(store)
            loadStores()
            toast.success(`Facility "${store.name}" created successfully!`)
          }}
        />
      )}

      {createdStore && (
        <Modal
          title="Facility Created!"
          subtitle="Here are the facility details and unique store code."
          onClose={() => setCreatedStore(null)}
          footer={<Button variant="primary" onClick={() => setCreatedStore(null)}>Done</Button>}
        >
          <div className="alert alert-success">
            Facility <strong>{createdStore.name}</strong> has been registered. Staff members can use this store code to log in.
          </div>
          <div className="creds">
            <div className="row">
              <span className="k">Facility Name</span>
              <span className="v">{createdStore.name}</span>
            </div>
            <div className="row">
              <span className="k">Store Code</span>
              <span className="v" style={{ fontWeight: 700, color: 'var(--caramel-500)' }}>
                {createdStore.storeCode}
              </span>
            </div>
            <div className="row">
              <span className="k">Store Email</span>
              <span className="v">{createdStore.email}</span>
            </div>
          </div>
          <div style={{ marginTop: '14px' }}>
            <CopyButton
              text={`Store Name: ${createdStore.name}\nStore Code: ${createdStore.storeCode}\nLogin URL: ${window.location.origin}/login`}
              label="Copy Store Code & Details"
            />
          </div>
        </Modal>
      )}
    </>
  )
}

function CreateStoreModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', gstIn: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)

    const next = {}
    if (form.name.trim().length < 2) next.name = 'Facility name must be at least 2 characters'
    if (!isEmail(form.email.trim())) next.email = 'Enter a valid email'
    if (form.phone && form.phone.trim().length < 7) next.phone = 'Enter a valid phone number'
    if (form.gstIn && form.gstIn.trim().length !== 15) next.gstIn = 'GSTIN must be 15 characters'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
      }
      if (form.phone.trim()) payload.phone = form.phone.trim()
      if (form.address.trim()) payload.address = form.address.trim()
      if (form.gstIn.trim()) payload.gstIn = form.gstIn.trim().toUpperCase()

      const res = await api.post('/stores', payload)
      onSuccess(res.store)
      onClose()
    } catch (err) {
      setServerError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Add New Facility"
      subtitle="Register a new store branch for your confectionery brand."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button id="submit-facility-btn" type="submit" form="create-store-form" variant="primary" loading={loading}>
            Create Facility
          </Button>
        </>
      }
    >
      <form id="create-store-form" onSubmit={submit} noValidate>
        <ErrorAlert error={serverError} />
        <div className="form-grid">
          <div className="span-2">
            <TextField
              id="facility-name"
              label="Facility / Store Name"
              placeholder="e.g. Downtown Branch"
              icon={<IconBuilding size={18} />}
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />
          </div>
          <div className="span-2">
            <TextField
              id="facility-email"
              label="Store Email"
              type="email"
              placeholder="branch@yourconfectionery.com"
              icon={<IconMail size={18} />}
              value={form.email}
              onChange={set('email')}
              error={errors.email}
            />
          </div>
          <div className="span-2">
            <TextField
              id="facility-phone"
              label="Contact Phone (optional)"
              type="tel"
              placeholder="+91 9876543210"
              icon={<IconPhone size={18} />}
              value={form.phone}
              onChange={set('phone')}
              error={errors.phone}
            />
          </div>
          <div className="span-2">
            <TextField
              id="facility-address"
              label="Address (optional)"
              placeholder="Shop 4, Market Square, City"
              icon={<IconMapPin size={18} />}
              value={form.address}
              onChange={set('address')}
            />
          </div>
          <div className="span-2">
            <TextField
              id="facility-gstin"
              label="GSTIN (optional)"
              maxLength={15}
              style={{ textTransform: 'uppercase' }}
              placeholder="22AAAAA0000A1Z5"
              value={form.gstIn}
              onChange={set('gstIn')}
              error={errors.gstIn}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}

