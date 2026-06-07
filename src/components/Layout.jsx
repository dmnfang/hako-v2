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
      <div className="sidebar">
        <div className="sidebar-nav">
          {NAV.map(({ path, icon: Icon, label }) => (
            <div key={path} className="nav-btn-wrap">
              <button
                className={`nav-btn ${location.pathname === path ? 'active' : ''}`}
                onClick={() => navigate(path)}
              >
                <Icon size={14} />
              </button>
              <span className="nav-tooltip">{label}</span>
            </div>
          ))}
        </div>
        <div className="sidebar-content">
          {sidebar}
        </div>
      </div>
      <div className="main">
        {children}
      </div>
    </div>
  )
}