export const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Facility Admin',
  sales: 'Sales Staff',
  purchase: 'Purchase Staff',
}

export const MODULE_LABELS = {
  store: 'Store',
  user: 'Users',
  item: 'Items',
  category: 'Categories',
  party: 'Vendors / Parties',
  sale: 'Sales',
  sale_return: 'Sales returns',
  purchase: 'Purchases',
  purchase_return: 'Purchase returns',
  payment: 'Payments',
  ledger: 'Ledgers',
  stock: 'Stock',
  cashsession: 'Cash sessions',
  report: 'Reports',
}

// Mirrors the server rules: 8-72 chars, at least one letter and one number
export function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 72) return 'Password must be at most 72 characters'
  if (!/[A-Za-z]/.test(password)) return 'Password must contain a letter'
  if (!/\d/.test(password)) return 'Password must contain a number'
  return ''
}

export function passwordStrength(password) {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 4)
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

// Uses the browser CSPRNG; always satisfies the password policy
export function generatePassword(length = 12) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const all = letters + digits
  const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]
  const chars = [pick(letters), pick(digits)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never'
