import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import { ArrowRightLeft } from 'lucide-react'
import './Schedule.css'

const DAYS = [
  { label: 'Monday', short: 'Mon', value: 1 },
  { label: 'Tuesday', short: 'Tue', value: 2 },
  { label: 'Wednesday', short: 'Wed', value: 3 },
  { label: 'Thursday', short: 'Thu', value: 4 },
  { label: 'Friday', short: 'Fri', value: 5 },
]

const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6]

export default function Schedule() {
  const { schools, classes: allClasses } = useData()

  const [selectedDay, setSelectedDay] = useState(1)
  const [schedule, setSchedule] = useState([])
  const [dayCounts, setDayCounts] = useState({})
  const [daySchools, setDaySchools] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchBase() }, [])
  useEffect(() => { fetchDaySchedule() }, [selectedDay])

  async function fetchBase() {
    const { data: dayData } = await supabase
      .from('school_days').select('*, periods(*, period_slots(*, class:classes(label)))')

    const dc = {}
    const ds = {}
    dayData?.forEach(day => {
      const dow = day.day_of_week
      const slotCount = day.periods?.reduce((sum, p) => sum + (p.period_slots?.length ?? 0), 0) ?? 0
      dc[dow] = (dc[dow] ?? 0) + slotCount
      if (slotCount > 0) {
        if (!ds[dow]) ds[dow] = []
        const school = schools.find(s => s.id === day.school_id)
        if (school && !ds[dow].includes(school.name)) ds[dow].push(school.name)
      }
    })

    setDayCounts(dc)
    setDaySchools(ds)
    setLoading(false)
    fetchDaySchedule()
  }

  async function fetchDaySchedule() {
    const { data } = await supabase
      .from('school_days')
      .select('*, school:schools(id, name), periods(*, period_slots(*, class:classes(id, label, school_id)))')
      .eq('day_of_week', selectedDay)

    const slots = {}
    data?.forEach(sd => {
      sd.periods?.forEach(p => {
        if (!slots[p.period_number]) {
          slots[p.period_number] = {
            period_number: p.period_number,
            period_id: p.id,
            school_day_id: p.school_day_id,
            school: sd.school,
            school_id: sd.school_id,
            start_time: p.start_time,
            end_time: p.end_time,
            frequency: p.frequency ?? 'weekly',
            slots: (p.period_slots ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
          }
        }
      })
    })

    setSchedule(Object.values(slots).sort((a, b) => a.period_number - b.period_number))
  }

  async function assignSchoolToDay(periodNumber, schoolId) {
    let { data: sdData } = await supabase
      .from('school_days').select('id')
      .eq('school_id', schoolId).eq('day_of_week', selectedDay).maybeSingle()

    if (!sdData) {
      const { data: newSd } = await supabase
        .from('school_days').insert({ school_id: schoolId, day_of_week: selectedDay })
        .select().single()
      sdData = newSd
    }

    const { data: existingPeriod } = await supabase
      .from('periods').select('id')
      .eq('school_day_id', sdData.id)
      .eq('period_number', periodNumber)
      .maybeSingle()

    if (!existingPeriod) {
      await supabase.from('periods').insert({
        school_day_id: sdData.id,
        period_number: periodNumber,
        frequency: 'weekly',
        start_time: null,
        end_time: null,
      })
    }

    fetchDaySchedule()
    fetchBase()
  }

  async function setFrequency(periodId, frequency, existingSlots) {
    await supabase.from('periods').update({ frequency }).eq('id', periodId)

    if (frequency === 'alternating') {
      if (existingSlots.length === 0) {
        await supabase.from('period_slots').insert([
          { period_id: periodId, class_id: null, week_group: 'A', sort_order: 1 },
          { period_id: periodId, class_id: null, week_group: 'B', sort_order: 2 },
        ])
      } else if (existingSlots.length === 1) {
        await supabase.from('period_slots').update({ week_group: 'A', sort_order: 1 }).eq('id', existingSlots[0].id)
        await supabase.from('period_slots').insert({ period_id: periodId, class_id: null, week_group: 'B', sort_order: 2 })
      }
    }

    if (frequency === 'weekly' && existingSlots.length > 1) {
      for (const s of existingSlots.slice(1)) {
        await supabase.from('period_slots').delete().eq('id', s.id)
      }
    }

    fetchDaySchedule()
  }

  async function assignClassToSlot(slotId, classId, periodId) {
    if (slotId) {
      await supabase.from('period_slots').update({ class_id: classId || null }).eq('id', slotId)
    } else {
      await supabase.from('period_slots').insert({
        period_id: periodId,
        class_id: classId || null,
        week_group: 'A',
        sort_order: 1,
      })
    }
    fetchDaySchedule()
  }

  async function swapAlternatingSlots(periodId, slots) {
    const [a, b] = slots
    await Promise.all([
      supabase.from('period_slots').update({ sort_order: 2, week_group: 'B' }).eq('id', a.id),
      supabase.from('period_slots').update({ sort_order: 1, week_group: 'A' }).eq('id', b.id),
    ])
    fetchDaySchedule()
  }

  if (loading) return <Layout sidebar={<div />}><div /></Layout>

  const sidebar = (
    <div className="sch-sidebar">
      <div className="sch-sidebar-header">
        <h1 className="sch-sidebar-bigtitle">Periods</h1>
        <span className="sch-sidebar-title">Your weekly schedule</span>
      </div>
      <div className="sch-list">
        {DAYS.map(d => (
          <div
            key={d.value}
            className={`sch-row ${selectedDay === d.value ? 'selected' : ''}`}
            onClick={() => setSelectedDay(d.value)}
          >
            <div className="sch-row-top">
              <span className="sch-row-name">{d.label}</span>
              <span className="sch-row-count">{dayCounts[d.value] ?? 0}</span>
            </div>
            {(daySchools[d.value] ?? []).length > 0 && (
              <div className="sch-row-days">
                {daySchools[d.value].map(name => (
                  <span key={name} className="sch-day-chip">{name}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Layout sidebar={sidebar}>
      <div className="sch-main">
        <div className="sch-main-header">
          <span className="sch-main-title">{DAYS.find(d => d.value === selectedDay)?.label}</span>
          <span className="sch-main-dot" />
          <span className="sch-main-sub">{dayCounts[selectedDay] ?? 0} classes</span>
          {(daySchools[selectedDay] ?? []).length > 0 && (
            <>
              <span className="sch-main-dot" />
              <span className="sch-main-sub">{daySchools[selectedDay].join(' & ')}</span>
            </>
          )}
        </div>

        <div className="sch-period-list standalone">
          {PERIOD_NUMBERS.map(num => {
            const period = schedule.find(s => s.period_number === num)
            const frequency = period?.frequency ?? 'weekly'
            const slots = period?.slots ?? []
            const schoolClasses = allClasses.filter(c => c.school_id === period?.school_id)

            return (
              <div key={num} className="sch-period-row">

                {/* Row 1: dot + label */}
                <div className="sch-period-header-row">
                  <span className="sch-period-dot" />
                  <span className="sch-period-eyebrow">Period {num}</span>
                </div>

                {/* Row 2: school + time bar */}
                <div className={`sch-period-bar ${period ? 'configured' : ''}`}>
                  <select
                    className="sch-period-tap-chip"
                    value={period?.school_id ?? ''}
                    onChange={e => { if (e.target.value) assignSchoolToDay(num, e.target.value) }}
                  >
                    <option value="">No school</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {period && (
                    <span className="sch-period-time-chip">
                      {period.start_time ? `${period.start_time.slice(0, 5)} – ${period.end_time?.slice(0, 5)}` : 'No time'}
                    </span>
                  )}
                </div>

                {/* Row 3: frequency + class slot(s) */}
                {period && (
                  <div className="sch-period-bar class-bar">
                    <select
                      className="sch-period-tap-chip freq"
                      value={frequency}
                      onChange={e => setFrequency(period.period_id, e.target.value, slots)}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="alternating">Alternating</option>
                    </select>

                    {frequency === 'weekly' && (
                      <select
                        className="sch-period-tap-chip class"
                        value={slots[0]?.class_id ?? ''}
                        onChange={e => assignClassToSlot(slots[0]?.id, e.target.value, period.period_id)}
                      >
                        <option value="">No class</option>
                        {schoolClasses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    )}

                    {frequency === 'alternating' && (
                      <>
                        <span className="sch-ab-label">A</span>
                        <select
                          className="sch-period-tap-chip class"
                          value={slots[0]?.class_id ?? ''}
                          onChange={e => assignClassToSlot(slots[0]?.id, e.target.value, period.period_id)}
                        >
                          <option value="">No class</option>
                          {schoolClasses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <span className="sch-ab-label">B</span>
                        <select
                          className="sch-period-tap-chip class"
                          value={slots[1]?.class_id ?? ''}
                          onChange={e => assignClassToSlot(slots[1]?.id, e.target.value, period.period_id)}
                        >
                          <option value="">No class</option>
                          {schoolClasses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <button
                          className="sch-swap-btn"
                          onClick={() => swapAlternatingSlots(period.period_id, slots)}
                        >
                          <ArrowRightLeft size={13} />
                        </button>
                      </>
                    )}
                  </div>
                )}

              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}