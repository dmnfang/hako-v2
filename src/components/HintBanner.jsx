import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function HintBanner({ id, message }) {
  const storageKey = `hint_dismissed_${id}`
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey)
    if (!dismissed) setVisible(true)
  }, [id])

  function dismiss() {
    localStorage.setItem(storageKey, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      background: '#EDFFD4',
      border: '0.5px solid #B8F060',
      borderRadius: 10,
      padding: '10px 14px',
      flexShrink: 0,
    }}>
      <span style={{
        flex: 1,
        fontFamily: "'Figtree', sans-serif",
        fontSize: 13,
        lineHeight: 1.6,
        color: '#2E6600',
      }}>
        {message}
      </span>
      <button
        onClick={dismiss}
        style={{
          width: 20,
          height: 20,
          border: 'none',
          background: 'transparent',
          color: '#3A8000',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: 4,
          transition: 'background 0.15s',
          padding: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#C8FA7A'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <X size={13} />
      </button>
    </div>
  )
}