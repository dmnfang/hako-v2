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

export default function Layout({ children, sidebar }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="shell">

      {/* Left unit: rail + sidebar flush together */}
      <div className="left-unit">

        {/* Rail */}
        <div className="rail">
          {NAV.map(({ path, icon: Icon, label }) => (
            <div key={path} className="nav-btn-wrap">
              <button
                className={`nav-btn ${location.pathname === path ? 'active' : ''}`}
                onClick={() => navigate(path)}
              >
                <Icon size={20} />
              </button>
              <span className="nav-tooltip">{label}</span>
            </div>
          ))}
        </div>

        {/* Sidebar content */}
        <div className="sidebar">
          {sidebar}
        </div>

      </div>

      {/* Main panel */}
      <div className="main">
        {children}
      </div>

    </div>
  )
}