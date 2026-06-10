import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, CalendarDays, School, BookOpen, User } from 'lucide-react'
import './Layout.css'

const NAV = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/schedule', icon: CalendarDays, label: 'Schedule' },
  { path: '/schools', icon: School, label: 'Schools' },
  { path: '/curriculum', icon: BookOpen, label: 'Courses' },
  { path: '/account', icon: User, label: 'Account' },
]

function NavButton({ path, icon: Icon, label, isActive, onClick }) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const timerRef = useRef(null)

  function showTooltip() {
    setTooltipVisible(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setTooltipVisible(false), 1000)
  }

  function hideTooltip() {
    clearTimeout(timerRef.current)
    setTooltipVisible(false)
  }

  return (
    <div
      className="nav-btn-wrap"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      <button
        className={`nav-btn ${isActive ? 'active' : ''}`}
        onClick={() => { hideTooltip(); onClick() }}
      >
        <Icon size={16} />
      </button>
      <span className={`nav-tooltip ${tooltipVisible ? 'visible' : ''}`}>{label}</span>
    </div>
  )
}

export default function Layout({ children, sidebar }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="shell">
      <div className="left-unit">
        <div className="rail">
          {NAV.map(({ path, icon, label }) => (
            <NavButton
              key={path}
              path={path}
              icon={icon}
              label={label}
              isActive={location.pathname === path}
              onClick={() => navigate(path)}
            />
          ))}
        </div>
        <div className="sidebar">
          {sidebar}
        </div>
      </div>
      <div className="main">
        {children}
      </div>
    </div>
  )
}