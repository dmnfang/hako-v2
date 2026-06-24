import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import { useDaySchedule, toLocalDateStr, getDayStatus } from '../hooks/useDaySchedule'
import { useIsMobile } from '../hooks/useMediaQuery'
import { X, ChevronLeft, ChevronRight, ArrowLeft, School, Clock, Users, BookOpen } from 'lucide-react'
import ResponsiveModal from '../components/ResponsiveModal'
import './Schedule.css'

const DAYS = [
  { label: 'Monday', short: 'Mon', value: 1 },
  { label: 'Tuesday', short: 'Tue', value: 2 },
  { label: 'Wednesday', short: 'Wed', value: 3 },
  { label: 'Thursday', short: 'Thu', value: 4 },
  { label: 'Friday', short: 'Fri', value: 5 },
]

const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6]

// ─── Regular Week period card ─────────────────────────────────────────────
// Period number is a tappable chip that opens the period config modal.
// Everything below is display-only.
function RegularPeriodCard({ num, period, onPeriodClick }) {
  const frequency = period?.frequency ?? 'weekly'
  const slots = period?.slots ?? []
  const isEmpty = !period || slots.every(s => !s.class_id)
  const schoolName = slots[0]?.school?.name ?? 'No school'
  const timeLabel = slots[0]?.start_time ? `${slots[0].start_time.slice(0,5)} – ${slots[0].end_time?.slice(0,5)}` : 'No time set'
  const classChips = slots.filter(s => s.class_id).map(s => s.class?.label).filter(Boolean)

  return (
    <div className={`sch-period-row ${isEmpty ? 'empty' : ''}`}>
      <div className="sch-period-bar">
        <button className="sch-period-eyebrow-chip" onClick={() => onPeriodClick(num)}>Period {num}</button>
        <div className="sch-period-info-col">
          <div className="sch-period-info-row">
            <span className="sch-period-tap-chip"><School size={13} />{schoolName}</span>
            <span className="sch-period-tap-chip"><Clock size={13} />{timeLabel}</span>
          </div>
          <div className="sch-period-info-row">
            {classChips.length > 0 ? (
              classChips.map((label, i) => <span key={i} className="sch-period-tap-chip"><Users size={13} />{label}</span>)
            ) : (
              <span className="sch-period-tap-chip empty"><Users size={13} />No class</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar period card ──────────────────────────────────────────────────
function PeriodCard({ num, period, isMultiClass, resolvedClassLabel, lessonLabel, onPeriodClick }) {
  const slots = period?.slots ?? []
  const isEmpty = !period || !slots[0]?.school_id || (!isMultiClass && !resolvedClassLabel)
  const timeLabel = slots[0]?.start_time ? `${slots[0].start_time.slice(0,5)} – ${slots[0].end_time?.slice(0,5)}` : 'Set time'

  return (
    <div className={`sch-period-row ${isEmpty ? 'empty' : ''}`}>
      <div className="sch-period-bar">
        <button className="sch-period-eyebrow-chip" onClick={() => onPeriodClick(num)}>Period {num}</button>
        <div className="sch-period-info-col">
          <div className="sch-period-info-row">
            <span className="sch-period-tap-chip"><School size={13} />{slots[0]?.school?.name ?? 'No school'}</span>
            <span className="sch-period-tap-chip"><Clock size={13} />{period ? timeLabel : '—'}</span>
          </div>
          <div className="sch-period-info-row">
            {isMultiClass ? (
              resolvedClassLabel ? (
                <>
                  <span className="sch-period-tap-chip"><Users size={13} />{resolvedClassLabel}</span>
                  {lessonLabel && <span className="sch-period-tap-chip"><BookOpen size={13} />{lessonLabel}</span>}
                </>
              ) : (
                <span className="sch-period-tap-chip empty"><Users size={13} />Select Class</span>
              )
            ) : (
              <>
                <span className={`sch-period-tap-chip ${!resolvedClassLabel ? 'empty' : ''}`}>
                  <Users size={13} />{resolvedClassLabel ?? 'No class'}
                </span>
                {lessonLabel && <span className="sch-period-tap-chip"><BookOpen size={13} />{lessonLabel}</span>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Regular Week tab ──────────────────────────────────────────────────────
function RegularWeekTab({ schools, allClasses, selectedDay, refreshSidebar, isMobile, onBack }) {
  const [schedule, setSchedule] = useState([])
  const [modal, setModal] = useState(null)
  const [modalPeriodNum, setModalPeriodNum] = useState(null)
  const [modalFreq, setModalFreq] = useState('weekly')
  const [modalSchoolId, setModalSchoolId] = useState(null)
  const [modalClassIds, setModalClassIds] = useState([])
  const [timeForm, setTimeForm] = useState({ start_time: '', end_time: '' })

  useEffect(() => { fetchDaySchedule() }, [selectedDay])

  async function fetchDaySchedule() {
    const { data } = await supabase
      .from('school_days')
      .select(`
        id, school_id,
        periods(
          id, period_number, school_day_id, frequency,
          period_slots(
            id, class_id, school_id, start_time, end_time, week_group, sort_order,
            school:schools(id, name),
            class:classes(id, label, school_id)
          )
        )
      `)
      .eq('day_of_week', selectedDay)

    const periodMap = {}
    data?.forEach(sd => {
      sd.periods?.forEach(p => {
        if (!periodMap[p.period_number]) {
          const slots = (p.period_slots ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          periodMap[p.period_number] = {
            id: p.id,
            period_number: p.period_number,
            school_day_id: p.school_day_id,
            frequency: p.frequency ?? 'weekly',
            slots,
          }
        }
      })
    })
    setSchedule(Object.values(periodMap).sort((a, b) => a.period_number - b.period_number))
  }

  async function getOrCreatePeriod(periodNumber, schoolId) {
    // Get or create school_day for this school+day
    let { data: sd } = await supabase
      .from('school_days').select('id')
      .eq('school_id', schoolId).eq('day_of_week', selectedDay).maybeSingle()
    if (!sd) {
      const { data: newSd } = await supabase
        .from('school_days').insert({ school_id: schoolId, day_of_week: selectedDay })
        .select().single()
      sd = newSd
    }
    // Get or create period
    let { data: period } = await supabase
      .from('periods').select('id, school_day_id')
      .eq('school_day_id', sd.id).eq('period_number', periodNumber).maybeSingle()
    if (!period) {
      const { data: newP } = await supabase
        .from('periods').insert({ school_day_id: sd.id, period_number: periodNumber, frequency: 'weekly' })
        .select().single()
      period = newP
    }
    return { sdId: sd.id, periodId: period.id }
  }

  function openPeriodModal(num) {
    const existing = schedule.find(s => s.period_number === num)
    const slots = existing?.slots ?? []
    setModalPeriodNum(num)
    setModalFreq(existing?.frequency ?? 'weekly')
    setModalSchoolId(slots[0]?.school_id ?? null)
    setModalClassIds(slots.filter(s => s.class_id).map(s => s.class_id))
    setTimeForm({
      start_time: slots[0]?.start_time?.slice(0,5) ?? '',
      end_time: slots[0]?.end_time?.slice(0,5) ?? '',
    })
    setModal('period_config')
  }

  function toggleModalClass(classId) {
    if (modalFreq === 'weekly') {
      setModalClassIds(prev => prev[0] === classId ? [] : [classId])
    } else {
      setModalClassIds(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId])
    }
  }

  function changeModalFreq(freq) {
    setModalFreq(freq)
    if (freq === 'weekly' && modalClassIds.length > 1) {
      setModalClassIds(prev => prev.slice(0, 1))
    }
  }

  function changeModalSchool(schoolId) {
    setModalSchoolId(schoolId)
    setModalClassIds([])
  }

  async function savePeriodConfig() {
    const { start_time, end_time } = timeForm
    const existing = schedule.find(s => s.period_number === modalPeriodNum)
    let periodId = existing?.id

    if (!periodId) {
      if (!modalSchoolId) { setModal(null); return }
      const created = await getOrCreatePeriod(modalPeriodNum, modalSchoolId)
      periodId = created.periodId
    }

    await supabase.from('periods').update({ frequency: modalFreq }).eq('id', periodId)

    const existingSlots = existing?.slots ?? []

    if (modalFreq === 'weekly') {
      const classId = modalClassIds[0] ?? null
      if (existingSlots[0]) {
        await supabase.from('period_slots').update({
          school_id: modalSchoolId, class_id: classId, start_time, end_time,
        }).eq('id', existingSlots[0].id)
      } else {
        await supabase.from('period_slots').insert({
          period_id: periodId, school_id: modalSchoolId, class_id: classId,
          start_time, end_time, week_group: 'A', sort_order: 1,
        })
      }
      for (const s of existingSlots.slice(1)) {
        await supabase.from('period_slots').delete().eq('id', s.id)
      }
    } else {
      // Multi Class — sync the pool to modalClassIds, all sharing school/time
      const existingClassIds = existingSlots.filter(s => s.class_id).map(s => s.class_id)
      for (const s of existingSlots) {
        if (s.class_id && !modalClassIds.includes(s.class_id)) {
          await supabase.from('period_slots').delete().eq('id', s.id)
        } else {
          await supabase.from('period_slots').update({
            school_id: modalSchoolId, start_time, end_time,
          }).eq('id', s.id)
        }
      }
      let nextSort = Math.max(0, ...existingSlots.map(s => s.sort_order ?? 0)) + 1
      for (const classId of modalClassIds) {
        if (!existingClassIds.includes(classId)) {
          await supabase.from('period_slots').insert({
            period_id: periodId, class_id: classId, school_id: modalSchoolId,
            start_time, end_time, week_group: 'A', sort_order: nextSort++,
          })
        }
      }
      // Ensure at least one slot exists to carry school/time even with an empty pool
      const remaining = existingSlots.filter(s => modalClassIds.includes(s.class_id) || !s.class_id)
      if (modalClassIds.length === 0 && remaining.length === 0) {
        await supabase.from('period_slots').insert({
          period_id: periodId, class_id: null, school_id: modalSchoolId,
          start_time, end_time, week_group: 'A', sort_order: 1,
        })
      }
    }

    await fetchDaySchedule()
    refreshSidebar()
    setModal(null)
  }

  const modalSchoolClasses = allClasses.filter(c => c.school_id === modalSchoolId)
  const dayLabel = DAYS.find(d => d.value === selectedDay)?.label

  return (
    <div className="sch-tab-content">
      <div className="sch-main">
        <div className="sch-main-header">
          {isMobile && (
            <button className="hm-back-btn" onClick={onBack}>
              <ArrowLeft size={16} />
            </button>
          )}
          <span className="sch-main-title">{dayLabel}</span>
          <span className="sch-main-dot" />
          <span className="sch-main-sub">{schedule.length} periods</span>
        </div>
        <div className="sch-period-list">
          {PERIOD_NUMBERS.map(num => {
            const period = schedule.find(s => s.period_number === num)
            return (
              <RegularPeriodCard
                key={num}
                num={num}
                period={period}
                onPeriodClick={openPeriodModal}
              />
            )
          })}
        </div>
      </div>

      {/* Period config modal */}
      {modal === 'period_config' && (
        <ResponsiveModal
          isMobile={isMobile}
          open
          onClose={() => setModal(null)}
          title={`Period ${modalPeriodNum} — ${dayLabel}`}
          footer={
            <>
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={savePeriodConfig} disabled={!modalSchoolId}>Save</button>
            </>
          }
        >
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <div className="modal-label modal-label-spaced">Single class or multi class?</div>
              <div className="sch-option-grid">
                {[{v:'weekly',title:'Single Class',desc:'This period is always the same class.'},{v:'alternating',title:'Multi Class',desc:'This period could be any of a pool of classes — choose which one each day.'}].map(opt => (
                  <div key={opt.v} onClick={() => changeModalFreq(opt.v)} className={`sch-option-card ${modalFreq===opt.v ? 'active' : ''}`}>
                    <div className="sch-option-radio" />
                    <div>
                      <div className="sch-option-title">{opt.title}</div>
                      <div className="sch-option-desc">{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="modal-label modal-label-spaced">Which school?</div>
              <div className="sch-modal-chips">
                {schools.map(s => (
                  <button key={s.id} className={`sch-modal-chip school ${modalSchoolId === s.id ? 'active' : ''}`} onClick={() => changeModalSchool(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="modal-label modal-label-spaced">
                {modalFreq === 'alternating' ? 'Which classes? (select all that apply)' : 'Which class?'}
              </div>
              {!modalSchoolId ? (
                <p style={{fontFamily:"'Figtree',sans-serif",fontSize:13,color:'#787878'}}>Choose a school first.</p>
              ) : (
                <div className="sch-modal-chips">
                  {modalFreq === 'weekly' && (
                    <button className={`sch-modal-chip ${modalClassIds.length === 0 ? 'active' : ''}`} onClick={() => setModalClassIds([])}>No class</button>
                  )}
                  {modalSchoolClasses.map(cl => (
                    <button key={cl.id} className={`sch-modal-chip class ${modalClassIds.includes(cl.id) ? 'active' : ''}`} onClick={() => toggleModalClass(cl.id)}>
                      {cl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="modal-label modal-label-spaced">What time?</div>
              <div style={{display:'flex',gap:12}}>
                <div className="sc-field"><span className="sc-field-label">START TIME</span><input className="sch-time-input" type="time" value={timeForm.start_time} onChange={e => setTimeForm(p=>({...p,start_time:e.target.value}))} /></div>
                <div className="sc-field"><span className="sc-field-label">END TIME</span><input className="sch-time-input" type="time" value={timeForm.end_time} onChange={e => setTimeForm(p=>({...p,end_time:e.target.value}))} /></div>
              </div>
            </div>

            <p style={{fontFamily:"'Figtree',sans-serif",fontSize:13,color:'#787878',margin:0}}>This will update all future {dayLabel}s.</p>
          </div>
        </ResponsiveModal>
      )}
    </div>
  )
}

// ─── Calendar tab ──────────────────────────────────────────────────────────
function CalendarTab({ schools, allClasses, progressCtx, selectedDate, isMobile, onBack }) {
  const [modal, setModal] = useState(null)
  const [modalPeriodIdx, setModalPeriodIdx] = useState(null)
  const [modalSlotIdx, setModalSlotIdx] = useState(0)
  const [modalChangeType, setModalChangeType] = useState('once')
  const [modalSchoolId, setModalSchoolId] = useState(null)
  const [modalClassId, setModalClassId] = useState(null)
  const [modalTimeForm, setModalTimeForm] = useState({ start_time: '', end_time: '' })
  const [modalStatus, setModalStatus] = useState('working')
  const [modalOtherClassId, setModalOtherClassId] = useState(null)
  const [modalMultiChangeType, setModalMultiChangeType] = useState('once')

  const {
    periods, periodOverrides, dayStatusOverride, lessons, lessonIndices,
    savePeriodSchoolOverride, savePeriodClassOverride, savePeriodTimeOverride, resolveTodayClass,
  } = useDaySchedule(selectedDate, allClasses, progressCtx)

  const dayStatus = getDayStatus(selectedDate, dayStatusOverride)
  const dow = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
  const modalPeriod = periods[modalPeriodIdx]
  const modalSlot = modalPeriod?.slots?.[modalSlotIdx]
  const modalSchoolClasses = allClasses.filter(c => c.school_id === (modalSlot?.school_id ?? modalSchoolId))

  // Resolve effective periods (base + overrides)
  function resolveSlot(slot, override) {
    if (!slot) return slot
    return {
      ...slot,
      school_id: override?.school_id ?? slot.school_id,
      school: override?.school_id ? schools.find(s => s.id === override.school_id) : slot.school,
      class_id: override?.class_id ?? slot.class_id,
      class: override?.class_id ? allClasses.find(c => c.id === override.class_id) : slot.class,
      start_time: override?.start_time ?? slot.start_time,
      end_time: override?.end_time ?? slot.end_time,
    }
  }

  async function handleResolveTodayClass(classId, addToPool) {
    await resolveTodayClass(periods[modalPeriodIdx], classId, addToPool, selectedDate)
    setModal(null)
    setModalOtherClassId(null)
    setModalMultiChangeType('once')
  }

  return (
    <div className="sch-tab-content">
      <div className="sch-main">
        <div className="sch-main-header sch-cal-header">
          <div className="sch-cal-header-row">
            {isMobile && (
              <button className="hm-back-btn" onClick={onBack}>
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="sch-main-title">{selectedDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</span>
            <button
              className={`home-status-chip home-status-${dayStatus.status} sch-change-status-btn`}
              onClick={() => { setModalStatus(dayStatus.status); setModal('status') }}
            >
              <span className="home-status-dot" />
              {dayStatus.label}
            </button>
          </div>
        </div>

        {dayStatus.status === 'weekend' ? (
          <div className="sch-cal-empty-state">
            <div className="sch-cal-empty-emoji">🌅</div>
            <div className="sch-cal-empty-title">Enjoy your weekend!</div>
            <div className="sch-cal-empty-sub">No classes scheduled.</div>
          </div>
        ) : dayStatus.status !== 'working' ? (
          <div className="sch-cal-empty-state sch-cal-empty-state-simple">
            No classes — {dayStatus.label}
          </div>
        ) : (
          <div className="sch-period-list">
            {PERIOD_NUMBERS.map(num => {
              const i = periods.findIndex(p => p.period_number === num)
              const period = periods[i]
              const override = period ? periodOverrides[period.id] : null
              const resolvedPeriod = period ? {
                ...period,
                slots: period.slots.map((slot, idx) => idx === 0 ? resolveSlot(slot, override) : slot),
              } : null
              const isMultiClass = period?.frequency === 'alternating'
              const resolvedClassId = isMultiClass
                ? (override?.class_id ?? null)
                : (resolvedPeriod?.slots?.[0]?.class_id ?? null)
              const resolvedCls = resolvedClassId ? allClasses.find(c => c.id === resolvedClassId) : null
              const currLessons = lessons[resolvedCls?.curriculum_id] ?? []
              const lesson = currLessons[lessonIndices[i] ?? 0]
              const lessonLabel = lesson ? [lesson.tag1, lesson.tag2].filter(Boolean).join(' · ') : null
              return (
                <PeriodCard
                  key={num}
                  num={num}
                  period={resolvedPeriod}
                  isMultiClass={isMultiClass}
                  resolvedClassLabel={resolvedCls?.label ?? null}
                  lessonLabel={lessonLabel}
                  onPeriodClick={n => {
                    const idx = periods.findIndex(p => p.period_number === n)
                    const slot = periods[idx]?.slots?.[0]
                    setModalPeriodIdx(idx)
                    setModalSlotIdx(0)
                    setModalSchoolId(slot?.school_id ?? null)
                    setModalClassId(slot?.class_id ?? null)
                    setModalTimeForm({ start_time: slot?.start_time?.slice(0,5) ?? '', end_time: slot?.end_time?.slice(0,5) ?? '' })
                    setModalChangeType('once')
                    setModal('period_config')
                  }}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Status modal */}
      {modal === 'status' && (
        <ResponsiveModal
          isMobile={isMobile}
          open
          onClose={() => setModal(null)}
          title={`Change Status — ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
          footer={
            <>
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={async () => { const { data: { user } } = await supabase.auth.getUser(); await supabase.from('day_status').upsert({ date: toLocalDateStr(selectedDate), status: modalStatus, user_id: user.id }, { onConflict: 'user_id,date' }); setModal(null) }}>Save</button>
            </>
          }
        >
          <div className="sch-modal-chips">
            {[{v:'working',label:'Working Day'},{v:'standby',label:'Standby Day'},{v:'holiday',label:'Public Holiday'},{v:'school_event',label:'School Event'},{v:'personal',label:'Personal Day'}].map(opt => (
              <button key={opt.v} className={`sch-modal-chip status ${modalStatus===opt.v?'active':''}`} onClick={() => setModalStatus(opt.v)}>{opt.label}</button>
            ))}
          </div>
        </ResponsiveModal>
      )}

      {/* School modal */}
      {modal === 'school' && (
        <ResponsiveModal
          isMobile={isMobile}
          open
          onClose={() => setModal(null)}
          title={`School — Period ${modalPeriod?.period_number}`}
          footer={
            <>
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={async () => { await savePeriodSchoolOverride(modalPeriod, modalSchoolId, modalSlotIdx, modalChangeType, selectedDate); setModal(null) }}>Save</button>
            </>
          }
        >
          <div className="sch-modal-chips">
            {schools.map(s => (
              <button key={s.id} className={`sch-modal-chip school ${modalSchoolId === s.id ? 'active' : ''}`} onClick={() => setModalSchoolId(s.id)}>{s.name}</button>
            ))}
          </div>
          <div className="sch-option-grid">
            {[{v:'once',title:`Just ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,desc:'One-time override only.'},{v:'permanent',title:`All future ${dow}s`,desc:'Updates your recurring schedule.'}].map(opt => (
              <div key={opt.v} onClick={() => setModalChangeType(opt.v)} className={`sch-option-card ${modalChangeType===opt.v ? 'active' : ''}`}>
                <div className="sch-option-radio" />
                <div>
                  <div className="sch-option-title">{opt.title}</div>
                  <div className="sch-option-desc">{opt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </ResponsiveModal>
      )}

      {/* Class modal */}
      {modal === 'class' && modalPeriod && (
        <ResponsiveModal
          isMobile={isMobile}
          open
          onClose={() => setModal(null)}
          title={`Class — Period ${modalPeriod.period_number}`}
          footer={
            <>
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={async () => { await savePeriodClassOverride(modalPeriod, modalClassId, modalSlotIdx, modalChangeType, selectedDate); setModal(null) }}>Save</button>
            </>
          }
        >
          <div className="sch-modal-chips">
            <button className={`sch-modal-chip ${!modalClassId ? 'active' : ''}`} onClick={() => setModalClassId(null)}>No class</button>
            {modalSchoolClasses.map(cl => (
              <button key={cl.id} className={`sch-modal-chip class ${modalClassId === cl.id ? 'active' : ''}`} onClick={() => setModalClassId(cl.id)}>{cl.label}</button>
            ))}
          </div>
          <div className="sch-option-grid">
            {[{v:'once',title:`Just ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,desc:'One-time override only.'},{v:'permanent',title:`All future ${dow}s`,desc:'Updates your recurring schedule.'}].map(opt => (
              <div key={opt.v} onClick={() => setModalChangeType(opt.v)} className={`sch-option-card ${modalChangeType===opt.v ? 'active' : ''}`}>
                <div className="sch-option-radio" />
                <div>
                  <div className="sch-option-title">{opt.title}</div>
                  <div className="sch-option-desc">{opt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </ResponsiveModal>
      )}

      {/* Time modal */}
      {modal === 'time' && modalPeriod && (
        <ResponsiveModal
          isMobile={isMobile}
          open
          onClose={() => setModal(null)}
          title={`Time — Period ${modalPeriod.period_number}`}
          footer={
            <>
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={async () => { await savePeriodTimeOverride(modalPeriod, modalTimeForm, modalSlotIdx, modalChangeType, selectedDate); setModal(null) }}>Save</button>
            </>
          }
        >
          <div className="sch-modal-body-form">
            <div className="sc-field"><span className="sc-field-label">START TIME</span><input className="sch-time-input" type="time" value={modalTimeForm.start_time} onChange={e => setModalTimeForm(p=>({...p,start_time:e.target.value}))} autoFocus /></div>
            <div className="sc-field"><span className="sc-field-label">END TIME</span><input className="sch-time-input" type="time" value={modalTimeForm.end_time} onChange={e => setModalTimeForm(p=>({...p,end_time:e.target.value}))} /></div>
            <div className="sch-option-grid">
              {[{v:'once',title:`Just ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,desc:'One-time override only.'},{v:'permanent',title:`All future ${dow}s`,desc:'Updates your recurring schedule.'}].map(opt => (
                <div key={opt.v} onClick={() => setModalChangeType(opt.v)} className={`sch-option-card ${modalChangeType===opt.v ? 'active' : ''}`}>
                  <div className="sch-option-radio" />
                  <div>
                    <div className="sch-option-title">{opt.title}</div>
                    <div className="sch-option-desc">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ResponsiveModal>
      )}

      {/* Multi Class modal */}
      {modal === 'multi_class' && modalPeriod && (() => {
        const period = modalPeriod
        const pool = period.slots.filter(s => s.class_id)
        const poolIds = pool.map(s => s.class_id)
        const otherClasses = allClasses.filter(cl => cl.school_id === period.school_id && !poolIds.includes(cl.id))
        const resolvedClassId = periodOverrides[period.id]?.class_id ?? null

        return (
          <ResponsiveModal
            isMobile={isMobile}
            open
            onClose={() => setModal(null)}
            title={`Multi Class — Period ${period.period_number}`}
            footer={modalOtherClassId && (
              <>
                <button className="sch-form-cancel" onClick={() => setModalOtherClassId(null)}>Back</button>
                <button className="sch-form-save" onClick={() => handleResolveTodayClass(modalOtherClassId, modalMultiChangeType === 'permanent')}>Save</button>
              </>
            )}
          >
            <div className="modal-label modal-label-spaced">
              Which class is this on {selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}?
            </div>
            <div className="sch-multi-class-options">
              {pool.map(slot => {
                const cls = allClasses.find(c => c.id === slot.class_id)
                const currLessons = lessons[cls?.curriculum_id] ?? []
                const prog = progressCtx?.[slot.class_id]
                const idx = prog?.current_lesson_id
                  ? Math.max(0, currLessons.findIndex(l => l.id === prog.current_lesson_id))
                  : 0
                const lesson = currLessons[idx]
                const isResolved = resolvedClassId === slot.class_id
                return (
                  <div key={slot.id} className={`sch-multi-class-option ${isResolved ? 'active' : ''}`}>
                    <button
                      className="sch-period-tap-chip class"
                      onClick={() => handleResolveTodayClass(slot.class_id, false)}
                    >
                      {cls?.label ?? '—'}
                    </button>
                    {lesson && (
                      <span className="sch-pool-chip">
                        {[lesson.tag1, lesson.tag2].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {otherClasses.length > 0 && (
              <>
                <div className="sch-multi-class-other-label">Not in your rotation?</div>
                <div className="sch-multi-class-other-options">
                  {otherClasses.map(cl => (
                    <button
                      key={cl.id}
                      className={`sch-modal-chip class ${modalOtherClassId === cl.id ? 'active' : ''}`}
                      onClick={() => setModalOtherClassId(cl.id)}
                    >
                      {cl.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {modalOtherClassId && (
              <div className="sch-option-grid sch-option-grid-spaced">
                {[{v:'once',title:`Just ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,desc:"One-time choice. This class isn't added to the rotation."},{v:'permanent',title:'Add to rotation',desc:'This class becomes a permanent option for this period.'}].map(opt => (
                  <div key={opt.v} onClick={() => setModalMultiChangeType(opt.v)} className={`sch-option-card ${modalMultiChangeType===opt.v ? 'active' : ''}`}>
                    <div className="sch-option-radio" />
                    <div>
                      <div className="sch-option-title">{opt.title}</div>
                      <div className="sch-option-desc">{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ResponsiveModal>
        )
      })()}
    </div>
  )
}

// ─── Main Schedule page ────────────────────────────────────────────────────
export default function Schedule() {
  const { schools, classes: allClasses, progress: progressCtx } = useData()
  const isMobile = useIsMobile()
  const [screen, setScreen] = useState('list') // mobile only: 'list' | 'detail'
  const [tab, setTab] = useState('regular')
  const [selectedDay, setSelectedDay] = useState(1)
  const [dayCounts, setDayCounts] = useState({})
  const [daySchools, setDaySchools] = useState({})
  const [periodSchoolMap, setPeriodSchoolMap] = useState({})
  const [monthSchoolOverrides, setMonthSchoolOverrides] = useState({}) // dateStr -> [{period_id, school_id}]
  const [calDate, setCalDate] = useState(new Date())
  const [calSelectedDate, setCalSelectedDate] = useState(new Date())

  const today = new Date()
  const cy = calDate.getFullYear()
  const cm = calDate.getMonth()
  const firstDow = new Date(cy, cm, 1).getDay()
  const daysInMonth = new Date(cy, cm + 1, 0).getDate()
  const trailingDow = (7 - ((firstDow + daysInMonth) % 7)) % 7

  async function fetchMonthSchoolOverrides() {
    const start = `${cy}-${String(cm + 1).padStart(2, '0')}-01`
    const end = `${cy}-${String(cm + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
    const { data } = await supabase
      .from('period_overrides')
      .select('date, period_id, school_id')
      .gte('date', start)
      .lte('date', end)
      .not('school_id', 'is', null)
    const byDate = {}
    data?.forEach(o => {
      if (!byDate[o.date]) byDate[o.date] = []
      byDate[o.date].push(o)
    })
    setMonthSchoolOverrides(byDate)
  }

  useEffect(() => { fetchMonthSchoolOverrides() }, [cy, cm, daysInMonth])

  function schoolsForDate(d) {
    const dow = d.getDay()
    const base = new Set(daySchools[dow] ?? [])
    const dateStr = toLocalDateStr(d)
    const overrides = monthSchoolOverrides[dateStr]
    if (overrides) {
      overrides.forEach(o => {
        const originalSchoolId = periodSchoolMap[o.period_id]
        const originalName = schools.find(s => s.id === originalSchoolId)?.name
        const newName = schools.find(s => s.id === o.school_id)?.name
        if (originalName) base.delete(originalName)
        if (newName) base.add(newName)
      })
    }
    return [...base]
  }

  async function fetchSidebar() {
    const { data: dayData } = await supabase
      .from('school_days').select('id, school_id, day_of_week, periods(id)')
    const dc = {}
    const schoolsPerDay = {}
    const periodSchool = {}
    dayData?.forEach(day => {
      const dow = day.day_of_week
      const periodCount = day.periods?.length ?? 0
      if (periodCount > 0) {
        if (!schoolsPerDay[dow]) schoolsPerDay[dow] = new Set()
        schoolsPerDay[dow].add(day.school_id)
        dc[dow] = (dc[dow] ?? 0) + periodCount
      }
      ;(day.periods ?? []).forEach(p => { periodSchool[p.id] = day.school_id })
    })
    setDayCounts(dc)
    setPeriodSchoolMap(periodSchool)
    const ds = {}
    Object.entries(schoolsPerDay).forEach(([dow, ids]) => {
      ds[parseInt(dow)] = [...ids].map(id => schools.find(s => s.id === id)?.name).filter(Boolean)
    })
    setDaySchools(ds)
  }

  useEffect(() => { fetchSidebar() }, [schools])

  const sidebar = (
    <div className="sch-sidebar">
      <div className="sch-sidebar-header">
        <h1 className="sch-sidebar-bigtitle">Schedule</h1>
        {tab === 'regular'
          ? <HintBanner id="schedule_regular" message="Set your standard weekly schedule here. Changes you make apply to every future occurrence of that day — this is your baseline." />
          : <HintBanner id="schedule_calendar" message="Make date-specific overrides here. Tap any chip on a period to change it for a specific date only, or update all future occurrences of that day." />
        }
        <div className="sch-sidebar-tabs">
          <button className={`sch-sidebar-tab ${tab === 'regular' ? 'active' : ''}`} onClick={() => setTab('regular')}>Regular Week</button>
          <button className={`sch-sidebar-tab ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>Calendar</button>
        </div>
      </div>

      {tab === 'regular' && (
        <div className="sch-list">
          {DAYS.map(d => (
            <div key={d.value} className={`sch-row ${selectedDay === d.value ? 'selected' : ''}`} onClick={() => { setSelectedDay(d.value); if (isMobile) setScreen('detail') }}>
              <div className="sch-row-top">
                <span className="sch-row-name">{d.label}</span>
                <span className="sch-row-count" style={{minWidth:24,justifyContent:'center'}}>{dayCounts[d.value] ?? 0}</span>
              </div>
              {(daySchools[d.value] ?? []).length > 0 && (
                <div className="sch-row-days">
                  {daySchools[d.value].map(name => <span key={name} className="sch-day-chip">{name}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="sch-cal-container">
          <div className="sch-cal-nav">
            <button className="sch-cal-today" onClick={() => { const t = new Date(); setCalDate(new Date(t.getFullYear(),t.getMonth(),1)); setCalSelectedDate(t) }}>Today</button>
            <span className="sch-cal-month">{calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
            <div className="sch-cal-nav-arrows">
              <button className="sch-modal-close" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}><ChevronLeft size={14} /></button>
              <button className="sch-modal-close" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="sch-cal-grid">
            {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => <div key={d} className="sch-cal-dow">{d}</div>)}
            {Array.from({length: firstDow}).map((_,i) => <div key={`e${i}`} className="sch-cal-day-empty" />)}
            {Array.from({length: daysInMonth}).map((_,i) => {
              const day = i + 1
              const d = new Date(cy, cm, day)
              const isToday = d.toDateString() === today.toDateString()
              const isSelected = d.toDateString() === calSelectedDate.toDateString()
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              const dayChips = schoolsForDate(d)
              return (
                <button key={day} className={`sch-cal-day ${isToday?'today':''} ${isSelected?'selected':''} ${isWeekend?'weekend':''}`} onClick={() => { setCalSelectedDate(d); if (isMobile) setScreen('detail') }}>
                  <span className="sch-cal-day-num">{day}</span>
                  {dayChips.length > 0 && (
                    <div className="sch-cal-day-chips">
                      {dayChips.slice(0, 3).map(name => (
                        <span key={name} className="sch-cal-day-chip">{name.split(' ')[0]}</span>
                      ))}
                      {dayChips.length > 3 && <span className="sch-cal-day-chip more">+{dayChips.length - 3}</span>}
                    </div>
                  )}
                </button>
              )
            })}
            {Array.from({length: trailingDow}).map((_,i) => <div key={`t${i}`} className="sch-cal-day-empty" />)}
          </div>
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div className="sch-mobile">
        {screen === 'list' && (
          <div className="hm-screen">
            {sidebar}
          </div>
        )}
        {screen === 'detail' && (
          <div className="hm-screen">
            <div className="sch-mobile-detail-body">
              {tab === 'regular'
                ? <RegularWeekTab schools={schools} allClasses={allClasses} selectedDay={selectedDay} refreshSidebar={fetchSidebar} isMobile onBack={() => setScreen('list')} />
                : <CalendarTab schools={schools} allClasses={allClasses} progressCtx={progressCtx} selectedDate={calSelectedDate} isMobile onBack={() => setScreen('list')} />
              }
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout sidebar={sidebar}>
      {tab === 'regular'
        ? <RegularWeekTab schools={schools} allClasses={allClasses} selectedDay={selectedDay} refreshSidebar={fetchSidebar} />
        : <CalendarTab schools={schools} allClasses={allClasses} progressCtx={progressCtx} selectedDate={calSelectedDate} />
      }
    </Layout>
  )
}