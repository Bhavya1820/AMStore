import { BrandMark, IconSpark } from './Icons'

export default function AuthShell({ children, wide }) {
  return (
    <div className="auth-shell">
      <section className="auth-hero" aria-label="AM Store">
        <div className="brand">
          <span className="brand-mark"><BrandMark /></span>
          AM Store
        </div>
        <div className="hero-copy">
          <h2>
            Run every counter of your <em>confectionery</em> from one sweet dashboard.
          </h2>
          <p>
            Inventory, sales, purchases and ledgers for every facility, with the right access for every team member.
          </p>
          <div className="hero-points">
            <span>Multi-store</span>
            <span>Role-based access</span>
            <span>Vendor ledgers</span>
            <span>Stock tracking</span>
          </div>
        </div>
        <small style={{ color: '#cbb8d3', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconSpark size={16} /> Made for bakeries, sweet shops and dessert cafés
        </small>
      </section>
      <section className="auth-panel">
        <div className={`auth-card${wide ? ' wide' : ''}`}>{children}</div>
      </section>
    </div>
  )
}
