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
        .select(`
          id,
          school_id,
          periods(
            id,
            period_number,
            school_day_id,
            frequency,
            period_slots(
              id,
              class_id,
              school_id,
              start_time,
              end_time,
              week_group,
              sort_order,
              school:schools(id, name),
              class:classes(id, label, school_id, curriculum_id, curriculum:curricula(id, name, grade_tag))
            )
          )
        `)
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

    // Merge all periods across school_days for this dow
    const periodMap = {}
    ;(sdRows ?? []).forEach(sd => {
      (sd.periods ?? []).forEach(p => {
        if (!periodMap[p.period_number]) {
          const slots = (p.period_slots ?? [])
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          periodMap[p.period_number] = {
            id: p.id,
            period_number: p.period_number,
            school_day_id: p.school_day_id,
            frequency: p.frequency ?? 'weekly',
            slots,
            // Resolved from slot[0] for convenience
            school_id: slots[0]?.school_id ?? sd.school_id,
            school: slots[0]?.school ?? null,
            start_time: slots[0]?.start_time ?? null,
            end_time: slots[0]?.end_time ?? null,
          }
        }
      })
    })

    const sorted = Object.values(periodMap).sort((a, b) => a.period_number - b.period_number)
    setPeriods(sorted)

    const ovMap = {}
    overrideData?.forEach(o => { ovMap[o.period_id] = o })
    setPeriodOverrides(ovMap)

    // Collect curriculum IDs for lesson fetching
    const currIds = [...new Set(sorted.flatMap(p =>
      p.slots.map(s => {
        const currId = s.class?.curriculum_id
        if (currId) return currId
        const cls = allClasses?.find(c => c.id === s.class_id)
        return cls?.curriculum_id
      }).filter(Boolean)
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
        if (period.frequency === 'alternating') {
          // Build index for each slot separately
          period.slots.forEach((slot, slotIdx) => {
            const classId = slot.class_id
            if (!classId) return
            const cls = allClasses?.find(c => c.id === classId)
            if (!cls?.curriculum_id) return
            const currLessons = lessonMap[cls.curriculum_id] ?? []
            const prog = progressCtx?.[classId]
            const idx = prog?.current_lesson_id
              ? Math.max(0, currLessons.findIndex(l => l.id === prog.current_lesson_id))
              : 0
            idxMap[`${i}_${slotIdx}`] = idx
          })
        } else {
          const classId = override?.class_id ?? period.slots[0]?.class_id
          if (!classId) return
          const cls = allClasses?.find(c => c.id === classId)
          if (!cls?.curriculum_id) return
          const currLessons = lessonMap[cls.curriculum_id] ?? []
          const prog = progressCtx?.[classId]
          const idx = prog?.current_lesson_id
            ? Math.max(0, currLessons.findIndex(l => l.id === prog.current_lesson_id))
            : 0
          idxMap[i] = idx
        }
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

  // Save functions — 'once' writes to period_overrides, 'permanent' writes to period_slots
  async function savePeriodSchoolOverride(period, schoolId, slotIdx = 0, changeType, date) {
    if (!period || !schoolId) return
    if (changeType === 'once') {
      await supabase.from('period_overrides').upsert({
        period_id: period.id,
        date: toLocalDateStr(date),
        school_id: schoolId,
      }, { onConflict: 'period_id,date' })
    } else {
      const slot = period.slots[slotIdx]
      if (slot?.id) {
        await supabase.from('period_slots').update({ school_id: schoolId }).eq('id', slot.id)
      }
    }
    fetchDateData(date)
  }

  async function savePeriodClassOverride(period, classId, slotIdx = 0, changeType, date) {
    if (!period) return
    if (changeType === 'once') {
      await supabase.from('period_overrides').upsert({
        period_id: period.id,
        date: toLocalDateStr(date),
        class_id: classId,
      }, { onConflict: 'period_id,date' })
    } else {
      const slot = period.slots[slotIdx]
      if (slot?.id) {
        await supabase.from('period_slots').update({ class_id: classId || null }).eq('id', slot.id)
      }
    }
    fetchDateData(date)
  }

  async function savePeriodTimeOverride(period, timeForm, slotIdx = 0, changeType, date) {
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
      const slot = period.slots[slotIdx]
      if (slot?.id) {
        await supabase.from('period_slots').update({ start_time, end_time }).eq('id', slot.id)
      }
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