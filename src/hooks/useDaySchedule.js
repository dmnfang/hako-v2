import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export function getDayStatus(date, override) {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return { status: 'weekend', label: 'Weekend' }
  if (override) {
    const labels = {
      standby: 'Standby Day',
      holiday: override.label ?? 'Public Holiday',
      personal: 'Personal Day',
      school_event: 'School Event',
    }
    return { status: override.status, label: labels[override.status] ?? override.status }
  }
  return { status: 'working', label: 'Working Day' }
}

export function useDaySchedule(date, allClasses, progressCtx) {
  const [periods, setPeriods] = useState([])
  const [periodOverrides, setPeriodOverrides] = useState({})
  const [dayStatusOverride, setDayStatusOverride] = useState(null)
  const [lessons, setLessons] = useState({})
  const [blocks, setBlocks] = useState({})
  const [lessonIndices, setLessonIndices] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!date) return
    fetchDateData(date)
  }, [date])

  async function fetchDateData(d) {
    setLoading(true)
    const dateStr = toLocalDateStr(d)
    const dow = d.getDay()

    const [{ data: sdRows }, { data: overrideData }, { data: statusData }] = await Promise.all([
      supabase
        .from('school_days')
        .select('*, school:schools(id,name), periods(*, period_slots(*, class:classes(*, curriculum:curricula(*))))')
        .eq('day_of_week', dow),
      supabase.from('period_overrides').select('*').eq('date', dateStr),
      supabase.from('day_status').select('*').eq('date', dateStr).maybeSingle(),
    ])

    setDayStatusOverride(statusData ?? null)

    const dayStatus = getDayStatus(d, statusData)
    if (dayStatus.status !== 'working') {
      setPeriods([])
      setPeriodOverrides({})
      setLoading(false)
      return
    }

    const allPeriods = (sdRows ?? []).flatMap(sd =>
      (sd.periods ?? []).map(p => ({ ...p, school_id: sd.school_id, school: sd.school }))
    )

    const sorted = [...allPeriods].sort((a, b) => a.period_number - b.period_number)
    setPeriods(sorted)

    const ovMap = {}
    overrideData?.forEach(o => { ovMap[o.period_id] = o })
    setPeriodOverrides(ovMap)

    const currIds = [...new Set(sorted.flatMap(p =>
      p.period_slots.map(s => s.class?.curriculum_id).filter(Boolean)
    ))]

    if (currIds.length > 0) {
      const { data: lessonData } = await supabase
        .from('lessons').select('*').in('curriculum_id', currIds).order('sort_order')
      const lessonMap = {}
      lessonData?.forEach(l => {
        if (!lessonMap[l.curriculum_id]) lessonMap[l.curriculum_id] = []
        lessonMap[l.curriculum_id].push(l)
      })
      setLessons(lessonMap)

      const idxMap = {}
      sorted.forEach((period, i) => {
        const override = ovMap[period.id]
        const classId = override?.class_id ?? period.period_slots[0]?.class?.id
        if (!classId) return
        const cls = allClasses.find(c => c.id === classId)
        if (!cls) return
        const currLessons = lessonMap[cls.curriculum_id] ?? []
        const prog = progressCtx?.[classId]
        const idx = prog?.current_lesson_id
          ? Math.max(0, currLessons.findIndex(l => l.id === prog.current_lesson_id))
          : 0
        idxMap[i] = idx
      })
      setLessonIndices(idxMap)
    } else {
      setLessons({})
      setLessonIndices({})
    }

    setLoading(false)
  }

  async function fetchBlocks(lessonId) {
    if (blocks[lessonId]) return
    const { data } = await supabase.from('blocks').select('*').eq('lesson_id', lessonId).order('sort_order')
    setBlocks(prev => ({ ...prev, [lessonId]: data ?? [] }))
  }

  async function savePeriodSchoolOverride(period, schoolId, changeType, date, dow) {
    if (!period || !schoolId) return
    if (changeType === 'once') {
      await supabase.from('period_overrides').upsert({
        period_id: period.id,
        date: toLocalDateStr(date),
        school_id: schoolId,
        class_id: null,
      }, { onConflict: 'period_id,date' })
    } else {
      await supabase.from('school_days').update({ school_id: schoolId }).eq('id', period.school_day_id)
    }
    fetchDateData(date)
  }

  async function savePeriodClassOverride(period, classId, changeType, date) {
    if (!period) return
    if (changeType === 'once') {
      await supabase.from('period_overrides').upsert({
        period_id: period.id,
        date: toLocalDateStr(date),
        class_id: classId,
        school_id: null,
      }, { onConflict: 'period_id,date' })
    } else {
      if (period.period_slots?.[0]?.id) {
        await supabase.from('period_slots').update({ class_id: classId }).eq('id', period.period_slots[0].id)
      }
    }
    fetchDateData(date)
  }

  async function savePeriodTimeOverride(period, timeForm, changeType, date) {
    if (!period) return
    const { start_time, end_time } = timeForm
    if (!start_time || !end_time) return
    if (changeType === 'once') {
      await supabase.from('period_overrides').upsert({
        period_id: period.id,
        date: toLocalDateStr(date),
        start_time,
        end_time,
      }, { onConflict: 'period_id,date' })
    } else {
      await supabase.from('periods').update({ start_time, end_time }).eq('id', period.id)
    }
    fetchDateData(date)
  }

  return {
    periods,
    periodOverrides,
    dayStatusOverride,
    lessons,
    blocks,
    lessonIndices,
    loading,
    fetchDateData,
    fetchBlocks,
    setLessonIndices,
    savePeriodSchoolOverride,
    savePeriodClassOverride,
    savePeriodTimeOverride,
  }
}