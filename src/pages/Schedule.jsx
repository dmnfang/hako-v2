import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import { ArrowRightLeft, X } from 'lucide-react'
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

  // Modal state
  const [modal, setModal] = useState(null) // 'school' | 'class' | 'freq'
  const [modalPeriodNum, setModalPeriodNum] = useState(null)
  const [modalSlotIdx, setModalSlotIdx] = useState(null) // for class modal: 0 or 1
  const [timeForm, setTimeForm] = useState({ start_time: '', end_time: '' })

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
    setModal(null)
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
    setModal(null)
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
    setModal(null)
  }

  async function swapAlternatingSlots(periodId, slots) {
    const [a, b] = slots
    await Promise.all([
      supabase.from('period_slots').update({ sort_order: 2, week_group: 'B' }).eq('id', a.id),
      supabase.from('period_slots').update({ sort_order: 1, week_group: 'A' }).eq('id', b.id),
    ])
    fetchDaySchedule()
  }

  async function saveTime(periodId) {
    const { start_time, end_time } = timeForm
    if (!start_time || !end_time) return
    await supabase.from('periods').update({ start_time, end_time }).eq('id', periodId)
    fetchDaySchedule()
    setModal(null)
  }

  // Modal period data
  const modalPeriod = schedule.find(s => s.period_number === modalPeriodNum)
  const modalSchoolClasses = allClasses.filter(c => c.school_id === modalPeriod?.school_id)

  if (loading) return <Layout sidebar={<div />}><div /></Layout>

  const sidebar = (
    <div className="sch-sidebar">
      <div className="sch-sidebar-header">
        <h1 className="sch-sidebar-bigtitle">Schedule</h1>
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
            const slotAClass = schoolClasses.find(c => c.id === slots[0]?.class_id)
            const slotBClass = schoolClasses.find(c => c.id === slots[1]?.class_id)

            return (
              <div key={num} className="sch-period-row">

                {/* Row 1: label */}
                <div className="sch-period-header-row">
                  <span className="sch-period-dot" />
                  <span className="sch-period-eyebrow">Period {num}</span>
                </div>

                {/* Row 2: school + time */}
                <div className="sch-period-bar">
                  <button
                    className="sch-period-tap-chip school"
                    onClick={() => { setModalPeriodNum(num); setModal('school') }}
                  >
                    {period?.school?.name ?? 'No school'}
                  </button>
                  {period && (
                    <button
                      className="sch-period-time-chip"
                      onClick={() => {
                        setModalPeriodNum(num)
                        setTimeForm({
                          start_time: period.start_time?.slice(0,5) ?? '',
                          end_time: period.end_time?.slice(0,5) ?? '',
                        })
                        setModal('time')
                      }}
                    >
                      {period.start_time ? `${period.start_time.slice(0, 5)} – ${period.end_time?.slice(0, 5)}` : 'Set time'}
                    </button>
                  )}
                </div>

                {/* Row 3: freq + class(es) */}
                {period && (
                  <div className="sch-period-bar">
                    <button
                      className="sch-period-tap-chip freq"
                      onClick={() => { setModalPeriodNum(num); setModal('freq') }}
                    >
                      {frequency === 'alternating' ? 'Alternating' : 'Weekly'}
                    </button>

                    {frequency === 'weekly' && (
                      <button
                        className="sch-period-tap-chip class"
                        onClick={() => { setModalPeriodNum(num); setModalSlotIdx(0); setModal('class') }}
                      >
                        {slotAClass?.label ?? 'No class'}
                      </button>
                    )}

                    {frequency === 'alternating' && (
                      <>
                        <span className="sch-ab-label">A</span>
                        <button
                          className="sch-period-tap-chip class"
                          onClick={() => { setModalPeriodNum(num); setModalSlotIdx(0); setModal('class') }}
                        >
                          {slotAClass?.label ?? 'No class'}
                        </button>
                        <span className="sch-ab-label">B</span>
                        <button
                          className="sch-period-tap-chip class"
                          onClick={() => { setModalPeriodNum(num); setModalSlotIdx(1); setModal('class') }}
                        >
                          {slotBClass?.label ?? 'No class'}
                        </button>
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

      {/* School modal */}
      {modal === 'school' && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">School — Period {modalPeriodNum}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body">
              <div className="sch-modal-chips">
                {schools.map(s => (
                  <button
                    key={s.id}
                    className={`sch-modal-chip school ${modalPeriod?.school_id === s.id ? 'active' : ''}`}
                    onClick={() => assignSchoolToDay(modalPeriodNum, s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Freq modal */}
      {modal === 'freq' && modalPeriod && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">Frequency — Period {modalPeriodNum}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body">
              <div className="sch-modal-chips">
                {['weekly', 'alternating'].map(f => (
                  <button
                    key={f}
                    className={`sch-modal-chip ${modalPeriod.frequency === f ? 'active' : ''}`}
                    onClick={() => setFrequency(modalPeriod.period_id, f, modalPeriod.slots)}
                  >
                    {f === 'weekly' ? 'Weekly' : 'Alternating'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Class modal */}
      {modal === 'class' && modalPeriod && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">
                Class — Period {modalPeriodNum}{modalPeriod.frequency === 'alternating' ? ` (${modalSlotIdx === 0 ? 'A' : 'B'})` : ''}
              </span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body">
              <div className="sch-modal-chips">
                <button
                  className={`sch-modal-chip ${!modalPeriod.slots[modalSlotIdx]?.class_id ? 'active' : ''}`}
                  onClick={() => assignClassToSlot(modalPeriod.slots[modalSlotIdx]?.id, null, modalPeriod.period_id)}
                >
                  No class
                </button>
                {modalSchoolClasses.map(c => (
                  <button
                    key={c.id}
                    className={`sch-modal-chip class ${modalPeriod.slots[modalSlotIdx]?.class_id === c.id ? 'active' : ''}`}
                    onClick={() => assignClassToSlot(modalPeriod.slots[modalSlotIdx]?.id, c.id, modalPeriod.period_id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time modal */}
      {modal === 'time' && modalPeriod && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">Time — Period {modalPeriodNum}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontFamily: "'Figtree',sans-serif", fontSize: 14, color: '#787878', width: 40 }}>Start</label>
                <input
                  className="sch-time-input"
                  type="time"
                  value={timeForm.start_time}
                  onChange={e => setTimeForm(p => ({ ...p, start_time: e.target.value }))}
                  style={{ flex: 1 }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontFamily: "'Figtree',sans-serif", fontSize: 14, color: '#787878', width: 40 }}>End</label>
                <input
                  className="sch-time-input"
                  type="time"
                  value={timeForm.end_time}
                  onChange={e => setTimeForm(p => ({ ...p, end_time: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={() => saveTime(modalPeriod.period_id)}>Save</button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}