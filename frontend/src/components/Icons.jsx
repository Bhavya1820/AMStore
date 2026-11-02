const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const make = (children) =>
  function Icon({ size, ...props }) {
    return (
      <svg {...base} {...(size ? { width: size, height: size } : {})} {...props}>
        {children}
      </svg>
    )
  }

export const IconDashboard = make(<><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>)
export const IconUsers = make(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.3c2 .7 3.5 2.5 3.5 5.7" /></>)
export const IconLogout = make(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>)
export const IconKey = make(<><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3" /><path d="m16 7 3 3" /><path d="m14 9 2 2" /></>)
export const IconLock = make(<><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>)
export const IconEye = make(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>)
export const IconEyeOff = make(<><path d="M3 3l18 18" /><path d="M10.6 6.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1" /><path d="M6.6 6.7C3.7 8.5 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>)
export const IconPlus = make(<><path d="M12 5v14" /><path d="M5 12h14" /></>)
export const IconSearch = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>)
export const IconShield = make(<><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>)
export const IconStore = make(<><path d="M4 9 5.5 4h13L20 9" /><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" /><path d="M5 11.5V20h14v-8.5" /><path d="M10 20v-5h4v5" /></>)
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />)
export const IconCopy = make(<><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>)
export const IconX = make(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>)
export const IconMenu = make(<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>)
export const IconMail = make(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>)
export const IconUser = make(<><circle cx="12" cy="8" r="4" /><path d="M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></>)
export const IconPhone = make(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />)
export const IconEdit = make(<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m14 6 4 4" /></>)
export const IconPower = make(<><path d="M12 3v9" /><path d="M6.4 6.4a8 8 0 1 0 11.2 0" /></>)
export const IconRefresh = make(<><path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4" /></>)
export const IconSpark = make(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />)
export const IconBuilding = make(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4" /></>)
export const IconMapPin = make(<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>)

export function BrandMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 40c0-8 5-10 6-16 1-5 5-8 6-8s5 3 6 8c1 6 6 8 6 16z" fill="#fff" />
      <rect x="18" y="40" width="28" height="8" rx="3" fill="#fff" />
    </svg>
  )
}
