import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import { useDaySchedule, toLocalDateStr, getDayStatus } from '../hooks/useDaySchedule'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import './Schedule.css'

const DAYS = [
  { label: 'Monday', short: 'Mon', value: 1 },
  { label: 'Tuesday', short: 'Tue', value: 2 },
  { label: 'Wednesday', short: 'Wed', value: 3 },
  { label: 'Thursday', short: 'Thu', value: 4 },
  { label: 'Friday', short: 'Fri', value: 5 },
]

const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6]

function PeriodCard({ num, period, allClasses, onSchoolClick, onClassClick, onFreqClick, onTimeClick }) {
  const frequency = period?.frequency ?? 'weekly'
  const slots = period?.slots ?? []
  const schoolClasses = allClasses.filter(c => c.school_id === period?.school_id)

  return (
    <div className="sch-period-row">
      <div className="sch-period-header-row">
        <span className="sch-period-eyebrow">Period {num}</span>
      </div>
      <div className="sch-period-bar">
        <button className="sch-period-tap-chip school" onClick={() => onSchoolClick(num)}>
          {period?.school?.name ?? 'No school'}
        </button>
        {period && (
          <button className="sch-period-time-chip" onClick={() => onTimeClick(num, period)}>
            {period.start_time ? `${period.start_time.slice(0,5)} – ${period.end_time?.slice(0,5)}` : 'Set time'}
          </button>
        )}
      </div>
      {period && (
        <div className="sch-period-bar">
          <button className="sch-period-tap-chip freq" onClick={() => onFreqClick(num)}>
            {frequency === 'alternating' ? 'Alternating' : 'Weekly'}
          </button>
          {frequency === 'weekly' && (
            <button className="sch-period-tap-chip class" onClick={() => onClassClick(num, 0)}>
              {schoolClasses.find(c => c.id === slots[0]?.class_id)?.label ?? 'No class'}
            </button>
          )}
          {frequency === 'alternating' && slots.map((slot, idx) => {
            const label = ['A','B','C','D'][idx]
            const cls = schoolClasses.find(c => c.id === slot.class_id)
            return (
              <React.Fragment key={slot.id ?? idx}>
                <span className="sch-ab-label">{label}</span>
                <button className="sch-period-tap-chip class" onClick={() => onClassClick(num, idx)}>
                  {cls?.label ?? 'No class'}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RegularWeekTab({ schools, allClasses, selectedDay, refreshSidebar }) {
  const [schedule, setSchedule] = useState([])
  const [modal, setModal] = useState(null)
  const [modalPeriodNum, setModalPeriodNum] = useState(null)
  const [activeSlot, setActiveSlot] = useState(0)
  const [timeForm, setTimeForm] = useState({ start_time: '', end_time: '' })
  const [modalFreq, setModalFreq] = useState('weekly')
  const [modalSlotCount, setModalSlotCount] = useState(2)
  const [modalSelectedSchoolId, setModalSelectedSchoolId] = useState(null)

  useEffect(() => { fetchDaySchedule() }, [selectedDay])

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
    if (!schoolId) return

    // Find the existing period
    const existing = schedule.find(s => s.period_number === periodNumber)

    // Get or create a school_day for the new school on this day
    let { data: sdData } = await supabase
      .from('school_days').select('id')
      .eq('school_id', schoolId).eq('day_of_week', selectedDay).maybeSingle()
    if (!sdData) {
      const { data: newSd } = await supabase
        .from('school_days').insert({ school_id: schoolId, day_of_week: selectedDay })
        .select().single()
      sdData = newSd
    }

    if (existing) {
      const oldSchoolDayId = existing.school_day_id
      // Move the period to the new school_day
      await supabase.from('periods').update({ school_day_id: sdData.id }).eq('id', existing.period_id)
      // Check if old school_day has any remaining periods — if not, delete it
      const { data: remainingPeriods } = await supabase
        .from('periods').select('id').eq('school_day_id', oldSchoolDayId)
      if (!remainingPeriods?.length) {
        await supabase.from('school_days').delete().eq('id', oldSchoolDayId)
      }
    } else {
      await supabase.from('periods').insert({
        school_day_id: sdData.id, period_number: periodNumber,
        frequency: 'weekly', start_time: null, end_time: null,
      })
    }

    await fetchDaySchedule()
    refreshSidebar()
    setModal(null)
  }

  async function saveFrequency(periodId, frequency, slotCount, existingSlots) {
    await supabase.from('periods').update({ frequency }).eq('id', periodId)
    const labels = ['A','B','C','D']
    if (frequency === 'alternating') {
      for (let i = 0; i < slotCount; i++) {
        if (existingSlots[i]) {
          await supabase.from('period_slots').update({ week_group: labels[i], sort_order: i + 1 }).eq('id', existingSlots[i].id)
        } else {
          await supabase.from('period_slots').insert({ period_id: periodId, class_id: null, week_group: labels[i], sort_order: i + 1 })
        }
      }
      for (const s of existingSlots.slice(slotCount)) {
        await supabase.from('period_slots').delete().eq('id', s.id)
      }
    }
    if (frequency === 'weekly') {
      for (const s of existingSlots.slice(1)) {
        await supabase.from('period_slots').delete().eq('id', s.id)
      }
    }
    await fetchDaySchedule()
    setModal(null)
  }

  async function assignClassToSlot(slotId, classId, periodId) {
    if (slotId) {
      await supabase.from('period_slots').update({ class_id: classId || null }).eq('id', slotId)
    } else {
      await supabase.from('period_slots').insert({ period_id: periodId, class_id: classId || null, week_group: 'A', sort_order: 1 })
    }
    await fetchDaySchedule()
    setModal(null)
  }

  async function saveTime(periodId) {
    const { start_time, end_time } = timeForm
    if (!start_time || !end_time) return
    await supabase.from('periods').update({ start_time, end_time }).eq('id', periodId)
    await fetchDaySchedule()
    setModal(null)
  }

  const modalPeriod = schedule.find(s => s.period_number === modalPeriodNum)
  const modalSchoolClasses = allClasses.filter(c => c.school_id === modalPeriod?.school_id)
  const isAlt = modalPeriod?.frequency === 'alternating'
  const activeSlotObj = isAlt ? modalPeriod?.slots[activeSlot] : modalPeriod?.slots[0]
  const dayLabel = DAYS.find(d => d.value === selectedDay)?.label

  return (
    <div className="sch-tab-content">
      <div className="sch-main">
        <div className="sch-main-header">
          <span className="sch-main-title">{dayLabel}</span>
          <span className="sch-main-dot" />
          <span className="sch-main-sub">{schedule.length} classes</span>
        </div>
        <div className="sch-period-list">
          {PERIOD_NUMBERS.map(num => {
            const period = schedule.find(s => s.period_number === num)
            return (
              <PeriodCard
                key={num}
                num={num}
                period={period}
                allClasses={allClasses}
                onSchoolClick={n => { const p = schedule.find(s => s.period_number === n); setModalPeriodNum(n); setModalSelectedSchoolId(p?.school_id ?? null); setModal('school') }}
                onFreqClick={n => { const p = schedule.find(s => s.period_number === n); setModalPeriodNum(n); setModalFreq(p?.frequency ?? 'weekly'); setModalSlotCount(p?.slots?.length ?? 2); setModal('freq') }}
                onClassClick={(n, idx) => { setModalPeriodNum(n); setActiveSlot(idx); setModal('class') }}
                onTimeClick={(n, p) => { setModalPeriodNum(n); setTimeForm({ start_time: p.start_time?.slice(0,5) ?? '', end_time: p.end_time?.slice(0,5) ?? '' }); setModal('time') }}
              />
            )
          })}
        </div>
      </div>

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
                  <button key={s.id} className={`sch-modal-chip school ${modalSelectedSchoolId === s.id ? 'active' : ''}`} onClick={() => setModalSelectedSchoolId(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
              <p style={{marginTop:12,fontFamily:"'Figtree',sans-serif",fontSize:13,color:'#787878'}}>This will update all future {dayLabel}s.</p>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={() => assignSchoolToDay(modalPeriodNum, modalSelectedSchoolId)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'freq' && modalPeriod && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">Frequency — Period {modalPeriodNum}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[{v:'weekly',title:'Weekly',desc:'The same class happens every week.'},{v:'alternating',title:'Alternating',desc:'Multiple classes rotate through this period.'}].map(opt => (
                  <div key={opt.v} onClick={() => setModalFreq(opt.v)} style={{border:modalFreq===opt.v?'1.5px solid #2DE6FF':'1.5px solid #E0E0E0',borderRadius:12,padding:12,cursor:'pointer',background:modalFreq===opt.v?'#DFFCFF':'#FFFFFF',display:'flex',gap:10,transition:'all 0.15s'}}>
                    <div style={{width:14,height:14,borderRadius:'50%',border:modalFreq===opt.v?'none':'1.5px solid #E0E0E0',background:modalFreq===opt.v?'#00C8E0':'#FFFFFF',flexShrink:0,marginTop:2}} />
                    <div>
                      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:14,fontWeight:600,color:'#0A100D',marginBottom:4}}>{opt.title}</div>
                      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:12,color:'#3D3D3D'}}>{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              {modalFreq === 'alternating' && (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <span style={{fontFamily:"'Figtree',sans-serif",fontSize:13,color:'#787878'}}>How many classes rotate for this period?</span>
                  <div style={{display:'flex',gap:8}}>
                    {[2,3,4].map(n => (
                      <button key={n} onClick={() => setModalSlotCount(n)} style={{flex:1,height:40,borderRadius:8,border:modalSlotCount===n?'1.5px solid #2DE6FF':'0.5px solid #E0E0E0',background:modalSlotCount===n?'#DFFCFF':'#FFFFFF',cursor:'pointer',fontFamily:"'Figtree',sans-serif",fontSize:16,fontWeight:700,color:modalSlotCount===n?'#007080':'#606060',transition:'all 0.15s'}}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p style={{fontFamily:"'Figtree',sans-serif",fontSize:13,color:'#787878'}}>This will update all future {dayLabel}s.</p>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={() => saveFrequency(modalPeriod.period_id, modalFreq, modalFreq==='weekly'?1:modalSlotCount, modalPeriod.slots)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'class' && modalPeriod && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">Class — Period {modalPeriodNum}{isAlt ? ` (${['A','B','C','D'][activeSlot]})` : ''}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body">
              <div className="sch-modal-chips">
                <button className={`sch-modal-chip ${!activeSlotObj?.class_id ? 'active' : ''}`} onClick={() => assignClassToSlot(activeSlotObj?.id, null, modalPeriod.period_id)}>No class</button>
                {modalSchoolClasses.map(cl => (
                  <button key={cl.id} className={`sch-modal-chip class ${activeSlotObj?.class_id === cl.id ? 'active' : ''}`} onClick={() => assignClassToSlot(activeSlotObj?.id, cl.id, modalPeriod.period_id)}>
                    {cl.label}
                  </button>
                ))}
              </div>
              <p style={{marginTop:12,fontFamily:"'Figtree',sans-serif",fontSize:13,color:'#787878'}}>This will update all future {dayLabel}s.</p>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'time' && modalPeriod && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">Time — Period {modalPeriodNum}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="sc-field"><span className="sc-field-label">START TIME</span><input className="sch-time-input" type="time" value={timeForm.start_time} onChange={e => setTimeForm(p=>({...p,start_time:e.target.value}))} autoFocus /></div>
              <div className="sc-field"><span className="sc-field-label">END TIME</span><input className="sch-time-input" type="time" value={timeForm.end_time} onChange={e => setTimeForm(p=>({...p,end_time:e.target.value}))} /></div>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={() => saveTime(modalPeriod.period_id)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CalendarTab({ schools, allClasses, progressCtx, selectedDate }) {
  const [modal, setModal] = useState(null)
  const [modalPeriodIdx, setModalPeriodIdx] = useState(null)
  const [modalChangeType, setModalChangeType] = useState('once')
  const [modalSchoolId, setModalSchoolId] = useState(null)
  const [modalClassId, setModalClassId] = useState(null)
  const [modalTimeForm, setModalTimeForm] = useState({ start_time: '', end_time: '' })
  const [modalStatus, setModalStatus] = useState('working')

  const {
    periods, periodOverrides, dayStatusOverride,
    savePeriodSchoolOverride, savePeriodClassOverride, savePeriodTimeOverride,
  } = useDaySchedule(selectedDate, allClasses, progressCtx)

  const dayStatus = getDayStatus(selectedDate, dayStatusOverride)
  const dow = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
  const modalPeriod = periods[modalPeriodIdx]
  const modalSchoolClasses = allClasses.filter(c => c.school_id === modalPeriod?.school_id)

  return (
    <div className="sch-tab-content">
      <div className="sch-main">
        <div className="sch-main-header" style={{flexDirection:'column',alignItems:'flex-start',gap:4}}>
          <div style={{display:'flex',alignItems:'center',gap:12,width:'100%'}}>
            <span className="sch-main-title">{selectedDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</span>
            <button className="sch-form-save" style={{marginLeft:'auto',height:32,padding:'0 12px',fontSize:14}} onClick={() => { setModalStatus(dayStatus.status); setModal('status') }}>
              Change Status
            </button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,fontFamily:"'Figtree',sans-serif",fontSize:14}}>
            <span style={{color:'#787878',fontWeight:500}}>Status:</span>
            <span style={{fontWeight:600}} className={`home-status-${dayStatus.status}`}>{dayStatus.label}</span>
          </div>
        </div>

        {dayStatus.status === 'weekend' ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,fontFamily:"'Figtree',sans-serif",fontSize:15,color:'#787878',textAlign:'center',padding:32}}>
            <div style={{fontSize:32}}>🌅</div>
            <div style={{fontWeight:600,color:'#0A100D'}}>Enjoy your weekend!</div>
            <div style={{fontSize:13}}>No classes scheduled.</div>
          </div>
        ) : dayStatus.status !== 'working' ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Figtree',sans-serif",fontSize:14,color:'#787878',padding:32}}>
            No classes — {dayStatus.label}
          </div>
        ) : (
          <div className="sch-period-list">
            {PERIOD_NUMBERS.map(num => {
              const period = periods.find(p => p.period_number === num)
              const override = period ? periodOverrides[period.id] : null
              const effectivePeriod = period ? {
                ...period,
                school_id: override?.school_id ?? period.school_id,
                school: override?.school_id ? schools.find(s => s.id === override.school_id) : period.school,
                start_time: override?.start_time ?? period.start_time,
                end_time: override?.end_time ?? period.end_time,
              } : null
              return (
                <PeriodCard
                  key={num}
                  num={num}
                  period={effectivePeriod}
                  allClasses={allClasses}
                  onSchoolClick={n => { setModalPeriodIdx(periods.findIndex(p => p.period_number === n)); setModalSchoolId(effectivePeriod?.school_id ?? null); setModalChangeType('once'); setModal('school') }}
                  onClassClick={(n, idx) => { setModalPeriodIdx(periods.findIndex(p => p.period_number === n)); setModalClassId(effectivePeriod?.slots?.[idx]?.class_id ?? null); setModalChangeType('once'); setModal('class') }}
                  onFreqClick={() => {}}
                  onTimeClick={(n, p) => { setModalPeriodIdx(periods.findIndex(pr => pr.period_number === n)); setModalTimeForm({ start_time: p.start_time?.slice(0,5) ?? '', end_time: p.end_time?.slice(0,5) ?? '' }); setModalChangeType('once'); setModal('time') }}
                />
              )
            })}
          </div>
        )}
      </div>

      {modal === 'status' && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">Change Status — {selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body">
              <div className="sch-modal-chips">
                {[{v:'working',label:'Working Day'},{v:'standby',label:'Standby Day'},{v:'holiday',label:'Public Holiday'},{v:'school_event',label:'School Event'},{v:'personal',label:'Personal Day'}].map(opt => (
                  <button key={opt.v} className={`sch-modal-chip status ${modalStatus===opt.v?'active':''}`} onClick={() => setModalStatus(opt.v)}>{opt.label}</button>
                ))}
              </div>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={async () => { await supabase.from('day_status').upsert({ date: toLocalDateStr(selectedDate), status: modalStatus }, { onConflict: 'date' }); setModal(null) }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'school' && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">School — Period {modalPeriod?.period_number}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="sch-modal-chips">
                {schools.map(s => (
                  <button key={s.id} className={`sch-modal-chip school ${modalSchoolId === s.id ? 'active' : ''}`} onClick={() => setModalSchoolId(s.id)}>{s.name}</button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[{v:'once',title:`Just ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,desc:'One-time override only.'},{v:'permanent',title:`All future ${dow}s`,desc:'Updates your recurring schedule.'}].map(opt => (
                  <div key={opt.v} onClick={() => setModalChangeType(opt.v)} style={{border:modalChangeType===opt.v?'1.5px solid #2DE6FF':'1.5px solid #E0E0E0',borderRadius:12,padding:12,cursor:'pointer',background:modalChangeType===opt.v?'#DFFCFF':'#FFFFFF',display:'flex',gap:10,transition:'all 0.15s'}}>
                    <div style={{width:14,height:14,borderRadius:'50%',border:modalChangeType===opt.v?'none':'1.5px solid #E0E0E0',background:modalChangeType===opt.v?'#00C8E0':'#FFFFFF',flexShrink:0,marginTop:2}} />
                    <div>
                      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:14,fontWeight:600,color:'#0A100D',marginBottom:4}}>{opt.title}</div>
                      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:12,color:'#3D3D3D'}}>{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={async () => { await savePeriodSchoolOverride(modalPeriod, modalSchoolId, modalChangeType, selectedDate); setModal(null) }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'class' && modalPeriod && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">Class — Period {modalPeriod.period_number}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="sch-modal-chips">
                <button className={`sch-modal-chip ${!modalClassId ? 'active' : ''}`} onClick={() => setModalClassId(null)}>No class</button>
                {modalSchoolClasses.map(cl => (
                  <button key={cl.id} className={`sch-modal-chip class ${modalClassId === cl.id ? 'active' : ''}`} onClick={() => setModalClassId(cl.id)}>{cl.label}</button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[{v:'once',title:`Just ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,desc:'One-time override only.'},{v:'permanent',title:`All future ${dow}s`,desc:'Updates your recurring schedule.'}].map(opt => (
                  <div key={opt.v} onClick={() => setModalChangeType(opt.v)} style={{border:modalChangeType===opt.v?'1.5px solid #2DE6FF':'1.5px solid #E0E0E0',borderRadius:12,padding:12,cursor:'pointer',background:modalChangeType===opt.v?'#DFFCFF':'#FFFFFF',display:'flex',gap:10,transition:'all 0.15s'}}>
                    <div style={{width:14,height:14,borderRadius:'50%',border:modalChangeType===opt.v?'none':'1.5px solid #E0E0E0',background:modalChangeType===opt.v?'#00C8E0':'#FFFFFF',flexShrink:0,marginTop:2}} />
                    <div>
                      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:14,fontWeight:600,color:'#0A100D',marginBottom:4}}>{opt.title}</div>
                      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:12,color:'#3D3D3D'}}>{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={async () => { await savePeriodClassOverride(modalPeriod, modalClassId, modalChangeType, selectedDate); setModal(null) }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'time' && modalPeriod && (
        <div className="sch-modal-overlay" onClick={() => setModal(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-header">
              <span className="sch-modal-title">Time — Period {modalPeriod.period_number}</span>
              <button className="sch-modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="sch-modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="sc-field"><span className="sc-field-label">START TIME</span><input className="sch-time-input" type="time" value={modalTimeForm.start_time} onChange={e => setModalTimeForm(p=>({...p,start_time:e.target.value}))} autoFocus /></div>
              <div className="sc-field"><span className="sc-field-label">END TIME</span><input className="sch-time-input" type="time" value={modalTimeForm.end_time} onChange={e => setModalTimeForm(p=>({...p,end_time:e.target.value}))} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[{v:'once',title:`Just ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,desc:'One-time override only.'},{v:'permanent',title:`All future ${dow}s`,desc:'Updates your recurring schedule.'}].map(opt => (
                  <div key={opt.v} onClick={() => setModalChangeType(opt.v)} style={{border:modalChangeType===opt.v?'1.5px solid #2DE6FF':'1.5px solid #E0E0E0',borderRadius:12,padding:12,cursor:'pointer',background:modalChangeType===opt.v?'#DFFCFF':'#FFFFFF',display:'flex',gap:10,transition:'all 0.15s'}}>
                    <div style={{width:14,height:14,borderRadius:'50%',border:modalChangeType===opt.v?'none':'1.5px solid #E0E0E0',background:modalChangeType===opt.v?'#00C8E0':'#FFFFFF',flexShrink:0,marginTop:2}} />
                    <div>
                      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:14,fontWeight:600,color:'#0A100D',marginBottom:4}}>{opt.title}</div>
                      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:12,color:'#3D3D3D'}}>{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="sch-modal-footer">
              <button className="sch-form-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="sch-form-save" onClick={async () => { await savePeriodTimeOverride(modalPeriod, modalTimeForm, modalChangeType, selectedDate); setModal(null) }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Schedule() {
  const { schools, classes: allClasses, progress: progressCtx } = useData()
  const [tab, setTab] = useState('regular')
  const [selectedDay, setSelectedDay] = useState(1)
  const [dayCounts, setDayCounts] = useState({})
  const [daySchools, setDaySchools] = useState({})
  const [calDate, setCalDate] = useState(new Date())
  const [calSelectedDate, setCalSelectedDate] = useState(new Date())

  const today = new Date()
  const cy = calDate.getFullYear()
  const cm = calDate.getMonth()
  const firstDow = new Date(cy, cm, 1).getDay()
  const daysInMonth = new Date(cy, cm + 1, 0).getDate()

  async function fetchSidebar() {
    const { data: dayData } = await supabase
      .from('school_days').select('*, periods(id)')
    const dc = {}
    const schoolsPerDay = {}
    dayData?.forEach(day => {
      const dow = day.day_of_week
      const periodCount = day.periods?.length ?? 0
      if (periodCount > 0) {
        if (!schoolsPerDay[dow]) schoolsPerDay[dow] = new Set()
        schoolsPerDay[dow].add(day.school_id)
      }
      dc[dow] = (dc[dow] ?? 0) + periodCount
    })
    setDayCounts(dc)
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
        <span className="sch-sidebar-title">
          {tab === 'regular' ? 'Set your standard working week.' : 'Manage specific date overrides.'}
        </span>
      </div>
      <div className="sch-sidebar-tabs">
        <button className={`sch-sidebar-tab ${tab === 'regular' ? 'active' : ''}`} onClick={() => setTab('regular')}>Regular Week</button>
        <button className={`sch-sidebar-tab ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>Calendar</button>
      </div>

      {tab === 'regular' && (
        <div className="sch-list">
          {DAYS.map(d => (
            <div key={d.value} className={`sch-row ${selectedDay === d.value ? 'selected' : ''}`} onClick={() => setSelectedDay(d.value)}>
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
        <div style={{padding:16,display:'flex',flexDirection:'column',gap:8,flex:1,overflow:'hidden'}}>
          <div className="sch-cal-nav">
            <button className="sch-cal-today" onClick={() => { const t = new Date(); setCalDate(new Date(t.getFullYear(),t.getMonth(),1)); setCalSelectedDate(t) }}>Today</button>
            <span className="sch-cal-month">{calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
            <div style={{display:'flex',gap:4}}>
              <button className="sch-modal-close" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}><ChevronLeft size={14} /></button>
              <button className="sch-modal-close" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="sch-cal-grid">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="sch-cal-dow">{d}</div>
            ))}
            {Array.from({length: firstDow}).map((_,i) => <div key={`e${i}`} />)}
            {Array.from({length: daysInMonth}).map((_,i) => {
              const day = i + 1
              const d = new Date(cy, cm, day)
              const isToday = d.toDateString() === today.toDateString()
              const isSelected = d.toDateString() === calSelectedDate.toDateString()
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <button key={day} className={`sch-cal-day ${isToday?'today':''} ${isSelected?'selected':''} ${isWeekend?'weekend':''}`} onClick={() => setCalSelectedDate(d)}>
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <Layout sidebar={sidebar}>
      {tab === 'regular'
        ? <RegularWeekTab schools={schools} allClasses={allClasses} selectedDay={selectedDay} refreshSidebar={fetchSidebar} />
        : <CalendarTab schools={schools} allClasses={allClasses} progressCtx={progressCtx} selectedDate={calSelectedDate} />
      }
    </Layout>
  )
}