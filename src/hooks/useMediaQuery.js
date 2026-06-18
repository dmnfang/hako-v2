import { useState, useEffect } from 'react'

/**
 * Returns true/false based on whether the given media query currently matches.
 * Usage: const isMobile = useMediaQuery('(max-width: 768px)')
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = e => setMatches(e.matches)
    setMatches(mql.matches)
    if (mql.addEventListener) mql.addEventListener('change', handler)
    else mql.addListener(handler) // Safari < 14 fallback
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler)
      else mql.removeListener(handler)
    }
  }, [query])

  return matches
}

// Shared breakpoint: covers phones and tablet portrait, per the design discussion.
export function useIsMobile() {
  return useMediaQuery('(max-width: 900px)')
}