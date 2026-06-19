import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { DataProvider, useData } from './context/DataContext'
import Home from './pages/Home'
import Curriculum from './pages/Curriculum'
import Schedule from './pages/Schedule'
import Schools from './pages/Schools'
import Account from './pages/Account'
import Wizard from './pages/Wizard'
import Login from './pages/Login'
import Runner from './pages/Runner'
import TrialGate from './components/TrialGate'

function AppRoutes({ session }) {
  const { ready, refresh } = useData()
  const [hasSchools, setHasSchools] = useState(undefined)

  async function checkSchools() {
    const { data } = await supabase.from('schools').select('id').limit(1)
    setHasSchools(data && data.length > 0)
  }

  useEffect(() => {
    if (!session) { setHasSchools(null); return }
    refresh().then(() => checkSchools())
  }, [session])

  if (session && (hasSchools === undefined || !ready)) return null

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/home" />} />
      <Route path="/runner/:classId/:lessonId" element={session ? <Runner /> : <Navigate to="/login" />} />

      <Route path="/wizard" element={
        session
          ? <TrialGate><Wizard onComplete={() => { setHasSchools(true); refresh() }} /></TrialGate>
          : <Navigate to="/login" />
      } />
      <Route path="/home" element={
        !session ? <Navigate to="/login" /> :
        hasSchools === false ? <Navigate to="/wizard" /> :
        <TrialGate><Home /></TrialGate>
      } />
      <Route path="/curriculum" element={
        session ? <TrialGate><Curriculum /></TrialGate> : <Navigate to="/login" />
      } />
      <Route path="/schedule" element={
        session ? <TrialGate><Schedule /></TrialGate> : <Navigate to="/login" />
      } />
      <Route path="/schools" element={
        session ? <TrialGate><Schools /></TrialGate> : <Navigate to="/login" />
      } />
      <Route path="/account" element={
        session ? <Account /> : <Navigate to="/login" />
      } />
      <Route path="*" element={<Navigate to={session ? '/home' : '/login'} />} />
    </Routes>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest('.sidebar, .main, .period-list, .right-panel, .sch-list, .sch-period-list, .curr-list, .curr-lesson-list, .acc-nav, .acc-main, .sc-list, .sc-class-list, .hm-period-list, .hm-block-list, .drawer-body, .home-mobile')) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', handler, { passive: false })
    return () => document.removeEventListener('touchmove', handler)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  return (
    <BrowserRouter basename="/hako-v2">
      <DataProvider>
        <AppRoutes session={session} />
      </DataProvider>
    </BrowserRouter>
  )
}