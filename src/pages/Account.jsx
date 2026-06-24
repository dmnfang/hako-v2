import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import { useIsMobile } from '../hooks/useMediaQuery'
import { LogOut, User, CreditCard, Settings } from 'lucide-react'
import './Account.css'

function getDaysDiff(dateA, dateB) {
  return Math.floor((dateB - dateA) / (1000 * 60 * 60 * 24))
}

function getTrialState(createdAt, graceUntil) {
  const now = new Date()
  const start = new Date(createdAt)
  const daysUsed = getDaysDiff(start, now)

  if (graceUntil) {
    const graceEnd = new Date(graceUntil)
    const graceDaysLeft = getDaysDiff(now, graceEnd)
    if (graceDaysLeft > 0) return { status: 'grace', daysLeft: graceDaysLeft, daysUsed, graceDaysLeft }
    return { status: 'expired', daysLeft: 0, daysUsed }
  }

  if (daysUsed >= 30) return { status: 'expired', daysLeft: 0, daysUsed }
  return { status: 'active', daysLeft: 30 - daysUsed, daysUsed: Math.min(daysUsed, 30) }
}

const NAV = [
  { key: 'profile', label: 'Personal Details', icon: User },
  { key: 'plan',    label: 'Plan',             icon: CreditCard },
  { key: 'app',     label: 'App Settings',     icon: Settings },
]

export default function Account() {
  const isMobile = useIsMobile()
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef(null)
  const [nameInput, setNameInput] = useState('')
  const [claimingGrace, setClaimingGrace] = useState(false)
  const [section, setSection] = useState('profile')
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setDisplayName(user?.user_metadata?.display_name ?? '')
    setNameInput(user?.user_metadata?.display_name ?? '')
    const { data: settingsData } = await supabase
      .from('settings').select('*').eq('user_id', user.id).maybeSingle()
    setSettings(settingsData)

    const [
      { count: schoolCount },
      { count: classCount },
      { count: courseCount },
      { count: lessonCount },
    ] = await Promise.all([
      supabase.from('schools').select('*', { count: 'exact', head: true }),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('curricula').select('*', { count: 'exact', head: true }),
      supabase.from('lessons').select('*', { count: 'exact', head: true }),
    ])
    setUsage({ schools: schoolCount ?? 0, classes: classCount ?? 0, courses: courseCount ?? 0, lessons: lessonCount ?? 0 })
    setLoading(false)
  }

  async function saveName() {
    await supabase.auth.updateUser({ data: { display_name: nameInput } })
    setDisplayName(nameInput)
    setEditingName(false)
  }

  async function claimGrace() {
    setClaimingGrace(true)
    const graceUntil = new Date()
    graceUntil.setDate(graceUntil.getDate() + 3)
    await supabase.from('settings').upsert({
      user_id: user.id, grace_until: graceUntil.toISOString(),
    }, { onConflict: 'user_id' })
    await fetchData()
    setClaimingGrace(false)
  }

  async function signOut() { await supabase.auth.signOut() }

  if (loading) {
    return isMobile
      ? <div className="acc-mobile" />
      : <Layout sidebar={<div />}><div /></Layout>
  }

  const trial = getTrialState(user.created_at, settings?.grace_until)
  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase()
  const progressPct = trial.status === 'grace'
    ? 100 : Math.min(100, (trial.daysUsed / 30) * 100)

  // ── Section inner content (shared between desktop card body and mobile accordion) ──
  const profileContent = (
    <div className="acc-card-body">
      <div className="acc-field">
        <span className="acc-field-label">Display name</span>
        <div className="acc-field-row">
          <input
            ref={nameInputRef}
            className="acc-input"
            value={nameInput}
            placeholder="Your name"
            onFocus={() => setEditingName(true)}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveName()
              if (e.key === 'Escape') { setEditingName(false); setNameInput(displayName) }
            }}
          />
          {editingName ? (
            <div className="acc-btn-group">
              <button className="acc-btn-save" onClick={saveName}>Save</button>
              <button className="acc-btn-cancel" onClick={() => { setEditingName(false); setNameInput(displayName) }}>Cancel</button>
            </div>
          ) : (
            <button className="acc-btn-edit" onClick={() => {
              setEditingName(true)
              setTimeout(() => {
                const el = nameInputRef.current
                if (el) { el.focus(); const len = el.value.length; el.setSelectionRange(len, len) }
              }, 0)
            }}>Edit</button>
          )}
        </div>
      </div>
      <div className="acc-field">
        <span className="acc-field-label">Email</span>
        <div className="acc-field-row">
          <span className="acc-field-value">{user.email}</span>
        </div>
      </div>
    </div>
  )

  const planContent = (
    <div className="acc-card-body">
      <div className="acc-trial-bar-wrap">
        <div
          className={`acc-trial-bar-fill ${trial.status}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="acc-trial-meta">
        <span className={`acc-trial-badge ${trial.status}`}>
          {trial.status === 'active' ? 'Active' : trial.status === 'grace' ? 'Grace Period' : 'Expired'}
        </span>
        <span className="acc-trial-label">
          {trial.status === 'active' && `${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} remaining`}
          {trial.status === 'grace' && `${trial.graceDaysLeft} grace day${trial.graceDaysLeft === 1 ? '' : 's'} left`}
          {trial.status === 'expired' && 'Trial ended'}
        </span>
      </div>
      {trial.status === 'active' && (
        <p className="acc-plan-desc">You're on a free 30-day trial with full access to everything. Upgrade before your trial ends to keep access.</p>
      )}
      {trial.status === 'grace' && (
        <p className="acc-plan-desc">Your trial has ended but you have <strong>{trial.graceDaysLeft} grace days</strong> remaining. Upgrade now to avoid losing access.</p>
      )}
      {trial.status === 'expired' && (
        <p className="acc-plan-desc">Your trial and grace period have both ended. Upgrade to restore full access.</p>
      )}
      {trial.status === 'expired' && !settings?.grace_until && (
        <button className="acc-btn-grace" onClick={claimGrace} disabled={claimingGrace}>
          {claimingGrace ? 'Claiming…' : 'Give me 3 more days'}
        </button>
      )}
      {usage && (
        <div className="acc-usage-wrap">
          <span className="acc-usage-title">Your saved data</span>
          <div className="acc-usage-grid">
            <div className="acc-usage-item">
              <span className="acc-usage-num">{usage.schools}</span>
              <span className="acc-usage-label">Schools</span>
            </div>
            <div className="acc-usage-item">
              <span className="acc-usage-num">{usage.classes}</span>
              <span className="acc-usage-label">Classes</span>
            </div>
            <div className="acc-usage-item">
              <span className="acc-usage-num">{usage.courses}</span>
              <span className="acc-usage-label">Courses</span>
            </div>
            <div className="acc-usage-item">
              <span className="acc-usage-num">{usage.lessons}</span>
              <span className="acc-usage-label">Lessons</span>
            </div>
          </div>
        </div>
      )}
      <button className="acc-btn-upgrade">Upgrade to Pro</button>
    </div>
  )

  const appContent = (
    <div className="acc-card-body">
      <div className="acc-setting-row">
        <div className="acc-setting-text">
          <span className="acc-setting-label">Dark mode</span>
          <span className="acc-setting-sub">Coming soon</span>
        </div>
        <div className="acc-toggle disabled" />
      </div>
      <div className="acc-setting-divider" />
      <div className="acc-setting-row">
        <div className="acc-setting-text">
          <span className="acc-setting-label">Sign out</span>
          <span className="acc-setting-sub">Sign out of your account on this device</span>
        </div>
        <button className="acc-btn-edit" onClick={signOut}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
      <div className="acc-setting-divider" />
      <div className="acc-setting-row">
        <div className="acc-setting-text">
          <span className="acc-setting-label acc-danger-label">Delete account</span>
          <span className="acc-setting-sub">Permanently delete your account and all data</span>
        </div>
        <button className="acc-btn-danger">Delete</button>
      </div>
    </div>
  )

  // ── Desktop card wrappers ───────────────────────────────────────────
  const profileSection = (
    <div className="acc-card">
      <div className="acc-card-header">
        <span className="acc-card-title">Personal Details</span>
      </div>
      {profileContent}
    </div>
  )

  const planSection = (
    <div className="acc-card">
      <div className="acc-card-header">
        <span className="acc-card-title">Plan</span>
        <span className="acc-free-badge">Free Trial</span>
      </div>
      {planContent}
    </div>
  )

  const appSection = (
    <div className="acc-card">
      <div className="acc-card-header">
        <span className="acc-card-title">App Settings</span>
      </div>
      {appContent}
    </div>
  )

  const sectionContent = {
    profile: profileSection,
    plan: planSection,
    app: appSection,
  }

  const accordionContent = {
    profile: profileContent,
    plan: planContent,
    app: appContent,
  }

  // ── Mobile layout — accordion ──────────────────────────────────────
  if (isMobile) {
    return (
      <div className="acc-mobile">
        <div className="acc-mobile-profile">
          <div className="acc-avatar">{initials}</div>
          <div className="acc-profile-text">
            <span className="acc-name">{displayName || 'No name set'}</span>
            <span className="acc-email">{user.email}</span>
          </div>
        </div>
        <div className="acc-mobile-accordion">
          {NAV.map(({ key, label, icon: Icon }) => {
            const isOpen = section === key
            return (
              <div key={key} className={`acc-accordion-item ${isOpen ? 'open' : ''}`}>
                <button
                  className="acc-accordion-header"
                  onClick={() => setSection(isOpen ? null : key)}
                >
                  <Icon size={16} className="acc-accordion-icon" />
                  <span className="acc-accordion-label">{label}</span>
                  {key === 'plan' && <span className="acc-free-badge" style={{fontSize:10,height:20,padding:'0 7px'}}>Free Trial</span>}
                  <span className="acc-accordion-chevron">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="acc-accordion-body">
                    {accordionContent[key]}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Desktop layout ─────────────────────────────────────────────────
  const sidebar = (
    <div className="acc-sidebar">
      <div className="acc-profile-block">
        <div className="acc-profile-identity">
          <div className="acc-avatar">{initials}</div>
          <div className="acc-profile-text">
            <span className="acc-name">{displayName || 'No name set'}</span>
            <span className="acc-email">{user.email}</span>
          </div>
        </div>
        <HintBanner id="account" message="Manage your profile, subscription, and app settings here." />
      </div>
      <div className="acc-nav">
        {NAV.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className={`acc-nav-row ${section === key ? 'selected' : ''}`}
            onClick={() => setSection(key)}
          >
            <Icon size={14} className="acc-nav-icon" />
            <span className="acc-nav-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Layout sidebar={sidebar}>
      <div className="acc-main">
        {sectionContent[section]}
      </div>
    </Layout>
  )
}