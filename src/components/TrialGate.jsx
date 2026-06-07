import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './TrialGate.css'

function getDaysDiff(dateA, dateB) {
  return Math.floor((dateB - dateA) / (1000 * 60 * 60 * 24))
}

function getTrialState(createdAt, graceUntil) {
  const now = new Date()
  const start = new Date(createdAt)
  const daysUsed = getDaysDiff(start, now)

  if (graceUntil) {
    const graceEnd = new Date(graceUntil)
    if (now < graceEnd) {
      const graceDaysLeft = getDaysDiff(now, graceEnd)
      return { status: 'grace', graceDaysLeft }
    }
    return { status: 'expired' }
  }

  if (daysUsed >= 30) return { status: 'expired', daysUsed }
  return { status: 'active' }
}

export default function TrialGate({ children }) {
  const [trialState, setTrialState] = useState(null)
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [claimingGrace, setClaimingGrace] = useState(false)
  const [graceClaimed, setGraceClaimed] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const { data: settingsData } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    setSettings(settingsData)

    const state = getTrialState(user.created_at, settingsData?.grace_until)
    setTrialState(state)
  }

  async function claimGrace() {
    setClaimingGrace(true)
    const graceUntil = new Date()
    graceUntil.setDate(graceUntil.getDate() + 3)
    await supabase.from('settings').upsert({
      user_id: user.id,
      grace_until: graceUntil.toISOString(),
    }, { onConflict: 'user_id' })
    setGraceClaimed(true)
    setClaimingGrace(false)
    await fetchData()
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Still loading
  if (!trialState) return null

  // Active or grace — let the app through
  if (trialState.status === 'active' || trialState.status === 'grace') {
    return children
  }

  // Expired — show lock screen
  const graceAlreadyClaimed = !!settings?.grace_until

  return (
    <div className="tg-shell">
      <div className="tg-card">
        <div className="tg-icon">⏱</div>
        <h1 className="tg-title">Your trial has ended</h1>
        <p className="tg-desc">
          Your 30-day free trial is up. Upgrade to Pro to keep access to all your lessons, classes, and schools.
        </p>

        <button className="tg-btn-upgrade">Upgrade to Pro</button>

        {!graceAlreadyClaimed && !graceClaimed && (
          <button
            className="tg-btn-grace"
            onClick={claimGrace}
            disabled={claimingGrace}
          >
            {claimingGrace ? 'Claiming…' : 'Give me 3 more days'}
          </button>
        )}

        {graceClaimed && (
          <p className="tg-grace-msg">
            You've got 3 more days. Make the most of it!
          </p>
        )}

        <button className="tg-btn-signout" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}