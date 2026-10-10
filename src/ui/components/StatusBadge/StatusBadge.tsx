import { useLocaleStore } from '../../../state/localeStore'
import './StatusBadge.css'

type StatusKind = 'poison' | 'injured' | 'stunned' | 'overwatch' | 'cloud' | 'apl-up' | 'apl-down' | 'mark' | 'other'

export function statusKind(marker: string): StatusKind {
  const value = marker.toUpperCase()
  if (value.startsWith('POISON')) return 'poison'
  if (value === 'INJURED') return 'injured'
  if (value === 'STUNNED') return 'stunned'
  if (value === 'OVERWATCH') return 'overwatch'
  if (value === 'FLY_CLOUD') return 'cloud'
  if (value.includes('APL') && value.includes('+')) return 'apl-up'
  if (value.includes('APL') && value.includes('-')) return 'apl-down'
  if (value === 'MARK' || value.startsWith('MARK_')) return 'mark'
  return 'other'
}

export function statusLabel(marker: string, locale: 'zh' | 'en'): string {
  const kind = statusKind(marker)
  const suffix = kind === 'poison' && marker.includes(':') ? ` · ${marker.split(':').slice(1).join(':').toUpperCase()}` : ''
  const labels: Record<StatusKind, [string, string]> = {
    poison: ['中毒', 'Poison'], injured: ['受伤', 'Injured'], stunned: ['震慑', 'Stunned'],
    overwatch: ['警戒', 'Overwatch'], cloud: ['蝇云', 'Fly Cloud'],
    'apl-up': ['APL +1', 'APL +1'], 'apl-down': ['APL −1', 'APL −1'],
    mark: ['印记', 'Mark'], other: [marker, marker],
  }
  return labels[kind][locale === 'zh' ? 0 : 1] + suffix
}

function StatusGlyph({ kind }: { kind: StatusKind }) {
  if (kind === 'poison') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 9.4 8.5 4H5L2.7 8l5.4 3.1M14.2 11.1 20 8l-2.3-4h-3.6l-2.9 5.4M9.8 14.2l.1 6.5h4.3l.1-6.5M12 9.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"/></svg>
  if (kind === 'injured') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/><path d="M10 7.5h4M12 5.5v4"/></svg>
  if (kind === 'stunned') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13.5 2-8 11h5l-1 9 9-12h-5z"/></svg>
  if (kind === 'overwatch') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/></svg>
  if (kind === 'cloud') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16a4 4 0 0 1 1-7.7A6 6 0 0 1 17 9a4 4 0 1 1 1 8H5"/><path d="m8 19 2-2m4 3 2-2"/></svg>
  if (kind === 'apl-up' || kind === 'apl-down') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={kind === 'apl-up' ? 'M12 20V4m-6 6 6-6 6 6' : 'M12 4v16m-6-6 6 6 6-6'}/></svg>
  if (kind === 'mark') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 10-9 10L3 12z"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
}

export function StatusBadge({ marker, compact = false }: { marker: string; compact?: boolean }) {
  const locale = useLocaleStore(s => s.locale)
  const kind = statusKind(marker)
  const label = statusLabel(marker, locale)
  return <span className={`status-badge ${compact ? 'compact' : ''}`} data-kind={kind} title={label} aria-label={label}>
    <StatusGlyph kind={kind} />{!compact && <span>{label}</span>}
  </span>
}
