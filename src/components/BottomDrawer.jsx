import { X } from 'lucide-react'
import './BottomDrawer.css'

/**
 * Mobile bottom sheet — slides up from the bottom, can grow tall to fit content
 * (e.g. the Multi Class option list), scrolls internally if content exceeds
 * viewport height. Used as the mobile equivalent of the desktop modal overlay.
 */
export default function BottomDrawer({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-sheet" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <span className="drawer-title">{title}</span>
          <button className="drawer-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
        {footer && (
          <div className="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}