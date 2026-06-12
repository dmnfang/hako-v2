import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import './HintBanner.css'

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
    <div className="hint-banner">
      <span className="hint-banner-text">{message}</span>
      <button className="hint-banner-close" onClick={dismiss}>
        <X size={13} />
      </button>
    </div>
  )
}