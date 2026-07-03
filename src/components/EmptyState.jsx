import './EmptyState.css'

/**
 * EmptyState — large Lucide icon + message, centered.
 *
 * Props:
 *   icon     — a Lucide icon component (e.g. BookOpen)
 *   message  — primary text string
 *   sub      — optional secondary string
 *   size     — icon size in px (default 120)
 *   compact  — if true, uses smaller padding for inline/list contexts
 */
export default function EmptyState({ icon: Icon, message, sub, size = 120, compact = false }) {
  return (
    <div className={`empty-state ${compact ? 'empty-state-compact' : ''}`}>
      {Icon && <Icon size={size} className="empty-state-icon" strokeWidth={1} />}
      <span className="empty-state-message">{message}</span>
      {sub && <span className="empty-state-sub">{sub}</span>}
    </div>
  )
}