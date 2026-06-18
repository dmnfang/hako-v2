import { X } from 'lucide-react'
import BottomDrawer from './BottomDrawer'

/**
 * Renders modal content as a bottom drawer on mobile, or the classic centered
 * modal overlay on desktop. Body content (children) and footer buttons stay
 * identical between both — only the chrome/wrapper changes.
 */
export default function ResponsiveModal({ isMobile, open, onClose, title, children, footer, wide }) {
  if (!open) return null

  if (isMobile) {
    return (
      <BottomDrawer open={open} onClose={onClose} title={title} footer={footer}>
        {children}
      </BottomDrawer>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal modal-date ${wide ? 'modal-wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}