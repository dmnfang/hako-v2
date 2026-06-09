import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import { useDaySchedule, toLocalDateStr, getDayStatus } from '../hooks/useDaySchedule'
import { GripVertical, ChevronLeft, ChevronRight, ChevronDown, X, Play, ArrowRightLeft, Pencil } from 'lucide-react'
import './Home.css'

const STATUS_OPTIONS = [
  { value: 'working', label: 'Working Day' },
  { value: 'standby', label: 'Standby Day' },
  { value: 'holiday', label: 'Public Holiday' },
  { value: 'school_event', label: 'School Event' },
  { value: 'personal', label: 'Personal Day' },
]

export default function Home() {
  const navigate = useNavigate()
  const today = new Date()

  const [selectedDate, setSelectedDate] = useState(today)
  const { schools, classes: allClasses, progress: progressCtx, lessons: allLessons, lessonsByCurriculum, refresh: refreshData } = useData()
  const [selectedSchoolId, setSelectedSchoolId] = useState(null)
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [expandedBlocks, setExpandedBlocks] = useState({})

  const {
    periods, periodOverrides, dayStatusOverride, lessons, blocks,
    lessonIndices, loading, fetchBlocks, setLessonIndices,
    savePeriodSchoolOverride: savePeriodSchoolOverrideHook,
    savePeriodClassOverride: savePeriodClassOverrideHook,
    savePeriodTimeOverride: savePeriodTimeOverrideHook,
  } = useDaySchedule(selectedDate, allClasses, progressCtx)

  const [modal, setModal] = useState(null)
  const [modalPeriodIdx, setModalPeriodIdx] = useState(null)
  const [modalChangeType, setModalChangeType] = useState('once')
  const [modalSchoolId, setModalSchoolId] = useState(null)
  const [modalStatus, setModalStatus] = useState('working')
  const [modalStatusLabel, setModalStatusLabel] = useState('')
  const [modalLessonPeriodIdx, setModalLessonPeriodIdx] = useState(null)
  const [modalLessonIdx, setModalLessonIdx] = useState(0)
  const [modalClassId, setModalClassId] = useState(null)
  const [modalTimeForm, setModalTimeForm] = useState({ start_time: '', end_time: '' })


  useEffect(() => {
    const period = periods[selectedPeriodIdx]
    if (!period) return
    const override = periodOverrides[period.id]
    const classId = override?.class_id ?? period.period_slots?.[0]?.class?.id
    if (!classId) return
    const cls = allClasses.find(c => c.id === classId)
    if (!cls) return
    const currLessons = lessons[cls.curriculum_id] ?? []
    const lesson = currLessons[lessonIndices[selectedPeriodIdx] ?? 0]
    if (lesson) {
      fetchBlocks(lesson.id)
      setExpandedBlocks({ [`${lesson.id}_0`]: true })
    }
  }, [selectedPeriodIdx, lessonIndices, periods, lessons])

  function navigateLesson(periodIdx, dir) {
    const period = periods[periodIdx]
    const override = periodOverrides[period?.id]
    const classId = override?.class_id ?? period?.period_slots?.[0]?.class?.id
    const cls = allClasses.find(c => c.id === classId)
    if (!cls) return
    const currLessons = lessons[cls.curriculum_id] ?? []
    const current = lessonIndices[periodIdx] ?? 0
    const next = Math.max(0, Math.min(currLessons.length - 1, current + dir))
    setLessonIndices(prev => ({ ...prev, [periodIdx]: next }))
  }

  function toggleBlock(key) {
    setExpandedBlocks(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function saveStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const dateStr = toLocalDateStr(selectedDate)

    if (modalStatus === 'working') {
      // Remove any override — revert to working day
      await supabase.from('day_status').delete().eq('date', dateStr).eq('user_id', user.id)
    } else {
      await supabase.from('day_status').upsert({
        user_id: user.id,
        date: dateStr,
        status: modalStatus,
        label: modalStatusLabel || null,
      }, { onConflict: 'user_id,date' })
    }

    setModal(null)
  }

  async function savePeriodSchoolOverride() {
    await savePeriodSchoolOverrideHook(periods[modalPeriodIdx], modalSchoolId, modalChangeType, selectedDate)
    setModal(null)
  }

  async function savePeriodClassOverride() {
    await savePeriodClassOverrideHook(periods[modalPeriodIdx], modalClassId, modalChangeType, selectedDate)
    setModal(null)
  }

  async function savePeriodTimeOverride() {
    await savePeriodTimeOverrideHook(periods[modalPeriodIdx], modalTimeForm, modalChangeType, selectedDate)
    setModal(null)
  }

  // Derived values
  const dayStatus = getDayStatus(selectedDate, dayStatusOverride)
  const isWorkingDay = dayStatus.status === 'working'

  const selectedPeriod = periods[selectedPeriodIdx]
  const periodOverride = selectedPeriod ? periodOverrides[selectedPeriod.id] : null
  const effectiveClassId = periodOverride?.class_id ?? selectedPeriod?.period_slots?.[0]?.class?.id
  const selectedClass = allClasses.find(c => c.id === effectiveClassId)
  const selectedLessons = lessons[selectedClass?.curriculum_id] ?? []
  const selectedLessonIdx = lessonIndices[selectedPeriodIdx] ?? 0
  const selectedLesson = selectedLessons[selectedLessonIdx]
  const selectedBlocks = selectedLesson ? (blocks[selectedLesson.id] ?? []) : []
  const selectedSchool = schools.find(s => s.id === selectedSchoolId)

  // Schools active today (from period schedule)
  const todaySchools = [...new Set(periods.map(p => {
    const ov = periodOverrides[p.id]
    return ov?.school_id ?? p.school_id
  }))].map(id => schools.find(s => s.id === id)?.name).filter(Boolean)

  const dow = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const classCount = periods.filter(p => {
    const ov = periodOverrides[p.id]
    return ov?.class_id ?? p.period_slots?.[0]?.class
  }).length

  if (loading) return <Layout sidebar={<div />}><div /></Layout>

  const sidebar = (
    <div className="home-sidebar">
      <div className="home-date-block">

        {/* Date line */}
        <div className="home-date-line">
          <span className="home-dow">{dow},</span>
          <span className="home-date">{dateStr}</span>
          {isWorkingDay && todaySchools.length > 0 && (
            <>
              <span className="home-date-at">at</span>
              <span className="home-school">{todaySchools.join(' & ')}</span>
            </>
          )}
        </div>

        {/* Status line */}
        <div className="home-status-line">
          <span className="home-status-label">Status:</span>
          <span className={`home-status-value home-status-${dayStatus.status}`}>{dayStatus.label}</span>
        </div>

        {/* Actions */}
        <div className="home-actions">
          <button
            className="home-action-btn primary"
            onClick={() => {
              setModalStatus(dayStatusOverride?.status ?? 'working')
              setModalStatusLabel(dayStatusOverride?.label ?? '')
              setModal('status')
            }}
          >
            <ArrowRightLeft size={14} /> Change Status
          </button>
        </div>

      </div>

      <div className="period-list">
        {!isWorkingDay && (
          <div className="no-periods">{dayStatus.label} — no classes scheduled.</div>
        )}
        {isWorkingDay && periods.length === 0 && (
          <div className="no-periods">No classes scheduled.</div>
        )}
        {isWorkingDay && periods.map((period, i) => {
          const override = periodOverrides[period.id]
          const effectiveSId = override?.school_id ?? period.school_id
          const effectiveCId = override?.class_id ?? period.period_slots?.[0]?.class?.id
          const cls = allClasses.find(c => c.id === effectiveCId)
          const periodSchool = schools.find(s => s.id === effectiveSId)
          const currLessons = lessons[cls?.curriculum_id] ?? []
          const lesson = currLessons[lessonIndices[i] ?? 0]
          const isSelected = i === selectedPeriodIdx

          return (
            <div
              key={period.id}
              className={`period-row ${isSelected ? 'selected' : ''} ${!cls ? 'no-class' : ''}`}
              onClick={() => setSelectedPeriodIdx(i)}
            >
              {/* Period label row */}
              <div className="period-header-row">
                <span className={`period-dot ${isSelected ? 'selected' : ''}`} />
                <span className="period-eyebrow">Period {period.period_number}</span>
              </div>

              {/* School + Time bar */}
              <div className="period-bar">
                <button
                  className="period-tap-chip school"
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedPeriodIdx(i)
                    setModalPeriodIdx(i)
                    setModalSchoolId(effectiveSId)
                    setModalChangeType('once')
                    setModal('period_school')
                  }}
                >
                  {periodSchool?.name ?? '—'}
                </button>
                <button className="period-tap-chip time" onClick={e => {
                    e.stopPropagation()
                    setSelectedPeriodIdx(i)
                    setModalPeriodIdx(i)
                    setModalTimeForm({
                      start_time: period.start_time?.slice(0,5) ?? '',
                      end_time: period.end_time?.slice(0,5) ?? '',
                    })
                    setModalChangeType('once')
                    setModal('period_time')
                  }}>
                  {period.start_time ? `${period.start_time.slice(0,5)} – ${period.end_time?.slice(0,5)}` : '—'}
                </button>
              </div>

              {/* Class + Lesson bar */}
              <div className="period-bar">
                <button
                  className={`period-tap-chip class ${!cls ? 'empty' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedPeriodIdx(i)
                    setModalPeriodIdx(i)
                    setModalClassId(cls?.id ?? null)
                    setModalChangeType('once')
                    setModal('period_class')
                  }}
                >
                  {cls?.label ?? '—'}
                </button>
                {cls && lesson && (
                  <span className="period-tap-chip" style={{cursor:'default'}}>
                    {[lesson.tag1, lesson.tag2].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <Layout sidebar={sidebar}>
      <div className="home-main">
        {selectedLesson ? (
          <>
            <div className="lesson-header">
              <div className="lesson-title-group">
                <span className="lesson-main-title">{selectedLesson.tag1 ?? '—'}</span>
                <span className="lesson-title-dot" />
                <span className="lesson-sub-title">{selectedLesson.tag2 ?? selectedLesson.title}</span>
              </div>
              <div className="lesson-nav">
                <button className="lesson-nav-btn" onClick={() => navigateLesson(selectedPeriodIdx, -1)} disabled={selectedLessonIdx === 0}>
                  <ChevronLeft size={14} />
                </button>
                <span className="lesson-count">{selectedLessonIdx + 1} / {selectedLessons.length}</span>
                <button className="lesson-nav-btn" onClick={() => navigateLesson(selectedPeriodIdx, 1)} disabled={selectedLessonIdx === selectedLessons.length - 1}>
                  <ChevronRight size={14} />
                </button>
              </div>
              <button className="edit-lesson-btn" onClick={() => navigate('/curriculum', {
                state: { lessonId: selectedLesson.id, curriculumId: selectedClass.curriculum_id }
              })}>
                <Pencil size={14} /> Edit Lesson
              </button>
              <button className="start-lesson-btn" onClick={() => navigate(`/runner/${selectedClass.id}/${selectedLesson.id}`)}>
                <Play size={14} /> Start Lesson
              </button>
            </div>
            <div className="block-list">
              {selectedBlocks.length === 0 && <div className="no-blocks">No blocks in this lesson yet.</div>}
              {selectedBlocks.map((block, i) => {
                const key = `${selectedLesson.id}_${i}`
                const isOpen = expandedBlocks[key]
                return (
                  <div key={block.id} className={`block-row ${isOpen ? 'open' : ''}`}>
                    <div className="block-row-header" onClick={() => toggleBlock(key)}>
                      <span className="block-title">{block.title}</span>
                      <button className="block-chevron-btn" onClick={e => { e.stopPropagation(); toggleBlock(key) }}>
                        <ChevronDown size={14} className={`block-chevron ${isOpen ? 'open' : ''}`} />
                      </button>
                    </div>
                    {isOpen && block.content && (
                      <div className="block-content-body">
                        {block.content.split('\n').filter(Boolean).map((line, j) => (
                          <div key={j} className="block-content-line">
                            <span className="block-bullet">•</span>
                            <span>{line.replace(/^[-•]\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="no-lesson-selected">
            {!isWorkingDay
              ? `${dayStatus.label} — enjoy your time off!`
              : selectedClass
                ? 'No lessons added yet.'
                : 'Select a period to see the lesson plan.'}
          </div>
        )}
      </div>

      {/* Change Status Modal */}
      {modal === 'status' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-date" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Change Status</span>
              <button className="modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-label">What kind of day is this?</div>
              <div className="modal-chips">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`modal-chip status ${modalStatus === opt.value ? 'active' : ''}`}
                    onClick={() => setModalStatus(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {modalStatus === 'holiday' && (
                <input
                  className="modal-label-input"
                  placeholder="Holiday name (e.g. Mountain Day)"
                  value={modalStatusLabel}
                  onChange={e => setModalStatusLabel(e.target.value)}
                  style={{ marginTop: 12 }}
                />
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn-save" onClick={saveStatus}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Period School Override Modal */}
      {modal === 'period_school' && modalPeriodIdx !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Change School — Period {periods[modalPeriodIdx]?.period_number}</span>
              <button className="modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-label">Which school for this period?</div>
              <div className="modal-chips">
                {schools.map(s => (
                  <button
                    key={s.id}
                    className={`modal-chip ${modalSchoolId === s.id ? 'active' : ''}`}
                    onClick={() => setModalSchoolId(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="modal-label" style={{ marginTop: 20 }}>What kind of change is this?</div>
              <div className="modal-change-types">
                <div className={`modal-change-card ${modalChangeType === 'once' ? 'active' : ''}`} onClick={() => setModalChangeType('once')}>
                  <div className="modal-change-check" />
                  <div>
                    <div className="modal-change-title">Just for today</div>
                    <div className="modal-change-desc">One-time override. Your regular schedule is unchanged.</div>
                  </div>
                </div>
                <div className={`modal-change-card ${modalChangeType === 'permanent' ? 'active' : ''}`} onClick={() => setModalChangeType('permanent')}>
                  <div className="modal-change-check" />
                  <div>
                    <div className="modal-change-title">All future {dow}s</div>
                    <div className="modal-change-desc">Updates your recurring schedule for this period.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn-save" onClick={savePeriodSchoolOverride}>Save Change</button>
            </div>
          </div>
        </div>
      )}

      {/* Period Class Override Modal */}
      {modal === 'period_class' && modalPeriodIdx !== null && (() => {
        const period = periods[modalPeriodIdx]
        const schoolClasses = allClasses.filter(cl => cl.school_id === period?.school_id)
        return (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">Change Class — Period {period?.period_number}</span>
                <button className="modal-close" onClick={() => setModal(null)}><X size={14} /></button>
              </div>
              <div className="modal-body">
                <div className="modal-label">Which class for this period?</div>
                <div className="modal-chips">
                  {schoolClasses.map(cl => (
                    <button
                      key={cl.id}
                      className={`modal-chip ${modalClassId === cl.id ? 'active' : ''}`}
                      style={modalClassId === cl.id ? { borderColor: '#2DE6FF', color: '#007080' } : {}}
                      onClick={() => setModalClassId(cl.id)}
                    >
                      {cl.label}
                    </button>
                  ))}
                </div>
                <div className="modal-label" style={{ marginTop: 20 }}>What kind of change is this?</div>
                <div className="modal-change-types">
                  <div className={`modal-change-card ${modalChangeType === 'once' ? 'active' : ''}`} onClick={() => setModalChangeType('once')}>
                    <div className="modal-change-check" />
                    <div>
                      <div className="modal-change-title">Just for today</div>
                      <div className="modal-change-desc">One-time override. Your regular schedule is unchanged.</div>
                    </div>
                  </div>
                  <div className={`modal-change-card ${modalChangeType === 'permanent' ? 'active' : ''}`} onClick={() => setModalChangeType('permanent')}>
                    <div className="modal-change-check" />
                    <div>
                      <div className="modal-change-title">All future {dow}s</div>
                      <div className="modal-change-desc">Updates your recurring schedule for this period.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button className="modal-btn-save" onClick={savePeriodClassOverride}>Save Change</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Period Time Override Modal */}
      {modal === 'period_time' && modalPeriodIdx !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-date" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Change Time — Period {periods[modalPeriodIdx]?.period_number}</span>
              <button className="modal-close" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-field">
                <span className="modal-field-label">START TIME</span>
                <input className="modal-label-input" type="time" value={modalTimeForm.start_time} onChange={e => setModalTimeForm(p => ({ ...p, start_time: e.target.value }))} autoFocus />
              </div>
              <div className="modal-field">
                <span className="modal-field-label">END TIME</span>
                <input className="modal-label-input" type="time" value={modalTimeForm.end_time} onChange={e => setModalTimeForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
              <div className="modal-change-types">
                <div className={`modal-change-card ${modalChangeType === 'once' ? 'active' : ''}`} onClick={() => setModalChangeType('once')}>
                  <div className="modal-change-check" />
                  <div>
                    <div className="modal-change-title">Just for today</div>
                    <div className="modal-change-desc">One-time override. Your regular schedule is unchanged.</div>
                  </div>
                </div>
                <div className={`modal-change-card ${modalChangeType === 'permanent' ? 'active' : ''}`} onClick={() => setModalChangeType('permanent')}>
                  <div className="modal-change-check" />
                  <div>
                    <div className="modal-change-title">All future {dow}s</div>
                    <div className="modal-change-desc">Updates your recurring schedule for this period.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn-save" onClick={savePeriodTimeOverride}>Save Change</button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Date Modal */}
      {modal === 'lesson' && (() => {
        const p = periods[modalLessonPeriodIdx]
        const effectiveCls = p?.override_class_id
          ? allClasses.find(c => c.id === p.override_class_id)
          : allClasses.find(c => c.id === p?.class_id)
        const currId = effectiveCls?.curriculum_id
        const currLessons = currId ? lessonsByCurriculum[currId] ?? [] : []
        const currentModalLesson = currLessons[modalLessonIdx]
        return (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal modal-date" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">Change Lesson</span>
                <button className="modal-close" onClick={() => setModal(null)}><X size={14} /></button>
              </div>
              <div className="modal-body">
                <div className="modal-sub">{effectiveCls?.label} — {curricula?.find(cu => cu.id === currId)?.name ?? 'No course'}</div>
                <div className="sch-lesson-picker-row" style={{display:'flex',alignItems:'center',gap:8,background:'#F5F5F5',borderRadius:8,padding:4}}>
                  <button
                    style={{width:32,height:32,borderRadius:8,border:'0.5px solid #E0E0E0',background:'#FFFFFF',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
                    onClick={() => setModalLessonIdx(i => Math.max(0, i - 1))}
                    disabled={modalLessonIdx === 0}
                  ><ChevronLeft size={14} /></button>
                  <span style={{flex:1,textAlign:'center',fontFamily:"'Figtree',sans-serif",fontSize:14,color:'#0A100D'}}>
                    {currentModalLesson
                      ? [currentModalLesson.tag1, currentModalLesson.tag2].filter(Boolean).join(' · ')
                      : 'No lessons'}
                  </span>
                  <button
                    style={{width:32,height:32,borderRadius:8,border:'0.5px solid #E0E0E0',background:'#FFFFFF',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
                    onClick={() => setModalLessonIdx(i => Math.min(currLessons.length - 1, i + 1))}
                    disabled={modalLessonIdx >= currLessons.length - 1}
                  ><ChevronRight size={14} /></button>
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button className="modal-btn-save" onClick={async () => {
                  if (!currentModalLesson || !effectiveCls) return
                  await supabase.from('class_progress').upsert({
                    class_id: effectiveCls.id,
                    current_lesson_id: currentModalLesson.id,
                  }, { onConflict: 'class_id' })
                  refreshData()
                  setModal(null)
                }}>Save</button>
              </div>
            </div>
          </div>
        )
      })()}

      {modal === 'date' && null}
    </Layout>
  )
}