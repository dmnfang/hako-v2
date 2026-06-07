import { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DataContext = createContext(null)

export function useData() {
  return useContext(DataContext)
}

export function DataProvider({ children }) {
  const [schools, setSchools] = useState([])
  const [classes, setClasses] = useState([])
  const [curricula, setCurricula] = useState([])
  const [lessons, setLessons] = useState([])       // flat list, all curricula
  const [progress, setProgress] = useState({})     // keyed by class_id
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const [
      { data: schoolData },
      { data: classData },
      { data: currData },
      { data: lessonData },
      { data: progressData },
    ] = await Promise.all([
      supabase.from('schools').select('*').order('sort_order'),
      supabase.from('classes').select('*, curriculum:curricula(*), school:schools(name)').order('sort_order'),
      supabase.from('curricula').select('*').order('sort_order'),
      supabase.from('lessons').select('id, tag1, tag2, title, curriculum_id, sort_order').order('sort_order'),
      supabase.from('class_progress').select('*, current_lesson:lessons(id, tag1, tag2, title, curriculum_id)'),
    ])

    setSchools(schoolData ?? [])
    setClasses(classData ?? [])
    setCurricula(currData ?? [])
    setLessons(lessonData ?? [])

    const progMap = {}
    progressData?.forEach(p => { progMap[p.class_id] = p })
    setProgress(progMap)

    setReady(true)
  }, [])

  // Helpers derived from state
  const lessonsByCurriculum = lessons.reduce((acc, l) => {
    if (!acc[l.curriculum_id]) acc[l.curriculum_id] = []
    acc[l.curriculum_id].push(l)
    return acc
  }, {})

  const classesBySchool = classes.reduce((acc, c) => {
    if (!acc[c.school_id]) acc[c.school_id] = []
    acc[c.school_id].push(c)
    return acc
  }, {})

  return (
    <DataContext.Provider value={{
      schools, classes, curricula, lessons, progress,
      lessonsByCurriculum, classesBySchool,
      refresh, ready,
    }}>
      {children}
    </DataContext.Provider>
  )
}