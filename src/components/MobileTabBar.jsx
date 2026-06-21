import { useNavigate, useLocation } from 'react-router-dom'
import { Home, CalendarDays, School, BookOpen, User } from 'lucide-react'
import './MobileTabBar.css'

const NAV = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/schedule', icon: CalendarDays, label: 'Schedule' },
  { path: '/schools', icon: School, label: 'Schools' },
  { path: '/curriculum', icon: BookOpen, label: 'Courses' },
  { path: '/account', icon: User, label: 'Account' },
]

export default function MobileTabBar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="mobile-tab-bar">
      {NAV.map(({ path, icon: Icon, label }) => {
        const isActive = location.pathname === path
        return (
          <button
            key={path}
            className={`mobile-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={20} />
            <span className="mobile-tab-label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}