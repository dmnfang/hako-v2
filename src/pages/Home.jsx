import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import { useDaySchedule, toLocalDateStr, getDayStatus } from '../hooks/useDaySchedule'
import { GripVertical, ChevronLeft, ChevronRight, ChevronDown, X, Play, ArrowRightLeft, Pencil, StickyNote } from 'lucide-react'
import HomeDesktop from './HomeDesktop'
import HomeMobile from './HomeMobile'
import { useIsMobile } from '../hooks/useMediaQuery'
import ResponsiveModal from '../components/ResponsiveModal'
import ErrorBoundary from '../components/ErrorBoundary'
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
  const isMobile = useIsMobile()
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
    resolveTodayClass,
    clearTodayClass,
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

  // Multi Class modal state
  const [modalOtherClassId, setModalOtherClassId] = useState(null)
  const [modalMultiChangeType, setModalMultiChangeType] = useState('once')

  const [previousMemo, setPreviousMemo] = useState(null)
  const [memoExpanded, setMemoExpanded] = useState(false)
  const [memoDraft, setMemoDraft] = useState('')


  useEffect(() => {
    const period = periods[selectedPeriodIdx]
    if (!period) return
    const override = periodOverrides[period.id]
    let classId
    if (period.frequency === 'alternating') {
      classId = override?.class_id ?? null
    } else {
      classId = override?.class_id ?? period.slots?.[0]?.class_id
    }
    if (!classId) return
    const cls = allClasses.find(c => c.id === classId)
    if (!cls) return
    const currLessons = lessons[cls.curriculum_id] ?? []
    const lesson = currLessons[lessonIndices[selectedPeriodIdx] ?? 0]
    if (lesson) {
      fetchBlocks(lesson.id)
    }
  }, [selectedPeriodIdx, lessonIndices, periods, lessons])

  function navigateLesson(periodIdx, dir) {
    const period = periods[periodIdx]
    const override = periodOverrides[period?.id]
    let classId
    if (period?.frequency === 'alternating') {
      classId = override?.class_id ?? null
    } else {
      classId = override?.class_id ?? period?.slots?.[0]?.class_id
    }
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
    await savePeriodSchoolOverrideHook(periods[modalPeriodIdx], modalSchoolId, 0, modalChangeType, selectedDate)
    setModal(null)
  }

  async function savePeriodClassOverride() {
    await savePeriodClassOverrideHook(periods[modalPeriodIdx], modalClassId, 0, modalChangeType, selectedDate)
    setModal(null)
  }

  async function savePeriodTimeOverride() {
    await savePeriodTimeOverrideHook(periods[modalPeriodIdx], modalTimeForm, 0, modalChangeType, selectedDate)
    setModal(null)
  }

  async function handleResolveTodayClass(classId, addToPool) {
    await resolveTodayClass(periods[modalPeriodIdx], classId, addToPool, selectedDate)
    setModal(null)
    setModalOtherClassId(null)
    setModalMultiChangeType('once')
  }

  // Derived values
  const dayStatus = getDayStatus(selectedDate, dayStatusOverride)
  const isWorkingDay = dayStatus.status === 'working'

  const selectedPeriod = periods[selectedPeriodIdx]
  const periodOverride = selectedPeriod ? periodOverrides[selectedPeriod.id] : null
  const isMultiClass = selectedPeriod?.frequency === 'alternating'
  const resolvedClassId = periodOverride?.class_id ?? null
  const effectiveClassId = isMultiClass ? resolvedClassId : (periodOverride?.class_id ?? selectedPeriod?.slots?.[0]?.class_id)
  const selectedClass = allClasses.find(c => c.id === effectiveClassId)
  const selectedLessons = lessons[selectedClass?.curriculum_id] ?? []
  const selectedLessonIdx = lessonIndices[selectedPeriodIdx] ?? 0
  const selectedLesson = selectedLessons[selectedLessonIdx]
  const selectedBlocks = selectedLesson ? (blocks[selectedLesson.id] ?? []) : []
  const previousLesson = selectedLessonIdx > 0 ? selectedLessons[selectedLessonIdx - 1] : null
  const selectedSchool = schools.find(s => s.id === selectedSchoolId)

  useEffect(() => {
    async function fetchPreviousMemo() {
      if (!previousLesson || !selectedClass) { setPreviousMemo(null); return }
      const { data } = await supabase
        .from('teaching_log')
        .select('*')
        .eq('lesson_id', previousLesson.id)
        .eq('class_id', selectedClass.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPreviousMemo(data ?? null)
    }
    fetchPreviousMemo()
    setMemoExpanded(false)
    setMemoDraft('')
  }, [previousLesson?.id, selectedClass?.id])

  async function saveMemo() {
    if (!selectedLesson || !selectedClass || !memoDraft.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('teaching_log').insert({
      user_id: user.id,
      lesson_id: selectedLesson.id,
      class_id: selectedClass.id,
      taught_on: toLocalDateStr(selectedDate),
      note: memoDraft.trim(),
    })
    setMemoDraft('')
  }

  // Schools active today (from period schedule)
  const todaySchools = [...new Set(periods.map(p => {
    const ov = periodOverrides[p.id]
    return ov?.school_id ?? p.slots?.[0]?.school_id ?? p.school_id
  }))].map(id => schools.find(s => s.id === id)?.name).filter(Boolean)

  const dow = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const classCount = periods.filter(p => {
    const ov = periodOverrides[p.id]
    return ov?.class_id ?? p.slots?.[0]?.class_id
  }).length

  if (loading) return <Layout sidebar={<div />}><div /></Layout>

  const sharedProps = {
    navigate,
    schools, allClasses, lessons, lessonIndices, periods, periodOverrides,
    dayStatus, dayStatusOverride, isWorkingDay, todaySchools, dow, dateStr,
    selectedPeriodIdx, setSelectedPeriodIdx,
    selectedPeriod, isMultiClass, resolvedClassId,
    selectedClass, selectedLessons, selectedLessonIdx, selectedLesson, selectedBlocks,
    expandedBlocks, toggleBlock, navigateLesson,
    previousMemo, memoExpanded, setMemoExpanded, memoDraft, setMemoDraft, saveMemo,
    setModal, setModalPeriodIdx, setModalSchoolId, setModalClassId, setModalChangeType,
    setModalStatus, setModalStatusLabel, setModalTimeForm,
    setModalOtherClassId, setModalMultiChangeType,
  }

  return (
    <>
      <ErrorBoundary>
        {isMobile ? <HomeMobile {...sharedProps} /> : <HomeDesktop {...sharedProps} />}
      </ErrorBoundary>

      {/* Change Status Modal */}
      {modal === 'status' && (
        <ResponsiveModal
          isMobile={isMobile}
          open
          onClose={() => setModal(null)}
          title="Change Status"
          footer={
            <>
              <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn-save" onClick={saveStatus}>Save</button>
            </>
          }
        >
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
        </ResponsiveModal>
      )}

      {/* Period School Override Modal */}
      {modal === 'period_school' && modalPeriodIdx !== null && (
        <ResponsiveModal
          isMobile={isMobile}
          open
          onClose={() => setModal(null)}
          title={`Change School — Period ${periods[modalPeriodIdx]?.period_number}`}
          footer={
            <>
              <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn-save" onClick={savePeriodSchoolOverride}>Save Change</button>
            </>
          }
        >
          <div className="modal-label">Which school for this period?</div>
          <div className="modal-chips">
            {schools.map(s => (
              <button
                key={s.id}
                className={`modal-chip school ${modalSchoolId === s.id ? 'active' : ''}`}
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
        </ResponsiveModal>
      )}

      {/* Period Class Override Modal */}
      {modal === 'period_class' && modalPeriodIdx !== null && (() => {
        const period = periods[modalPeriodIdx]
        const schoolClasses = allClasses.filter(cl => cl.school_id === period?.school_id)
        return (
          <ResponsiveModal
            isMobile={isMobile}
            open
            onClose={() => setModal(null)}
            title={`Change Class — Period ${period?.period_number}`}
            footer={
              <>
                <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button className="modal-btn-save" onClick={savePeriodClassOverride}>Save Change</button>
              </>
            }
          >
            <div className="modal-label">Which class for this period?</div>
            <div className="modal-chips">
              {schoolClasses.map(cl => (
                <button
                  key={cl.id}
                  className={`modal-chip class ${modalClassId === cl.id ? 'active' : ''}`}
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
          </ResponsiveModal>
        )
      })()}

      {/* Multi Class Modal */}
      {modal === 'multi_class' && modalPeriodIdx !== null && (() => {
        const period = periods[modalPeriodIdx]
        if (!period) return null
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
                <button className="modal-btn-cancel" onClick={() => setModalOtherClassId(null)}>Back</button>
                <button className="modal-btn-save" onClick={() => handleResolveTodayClass(modalOtherClassId, modalMultiChangeType === 'permanent')}>Save Change</button>
              </>
            )}
          >
            <div className="modal-label">Which class are you teaching today?</div>
            <div className="multi-class-options">
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
                  <div key={slot.id} className={`multi-class-option ${isResolved ? 'active' : ''}`}>
                    <button
                      className="period-tap-chip class"
                      onClick={() => handleResolveTodayClass(slot.class_id, false)}
                    >
                      {cls?.label ?? '—'}
                    </button>
                    {lesson && (
                      <span className="period-tap-chip" style={{cursor:'default'}}>
                        {[lesson.tag1, lesson.tag2].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {otherClasses.length > 0 && (
              <>
                <div className="multi-class-other-label">Not in your rotation?</div>
                <div className="multi-class-other-options">
                  {otherClasses.map(cl => (
                    <button
                      key={cl.id}
                      className={`multi-class-other-option ${modalOtherClassId === cl.id ? 'active' : ''}`}
                      onClick={() => setModalOtherClassId(cl.id)}
                    >
                      {cl.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {modalOtherClassId && (
              <>
                <div className="modal-label" style={{ marginTop: 16 }}>What kind of change is this?</div>
                <div className="modal-change-types">
                  <div className={`modal-change-card ${modalMultiChangeType === 'once' ? 'active' : ''}`} onClick={() => setModalMultiChangeType('once')}>
                    <div className="modal-change-check" />
                    <div>
                      <div className="modal-change-title">Just for today</div>
                      <div className="modal-change-desc">One-time choice. This class isn't added to the rotation.</div>
                    </div>
                  </div>
                  <div className={`modal-change-card ${modalMultiChangeType === 'permanent' ? 'active' : ''}`} onClick={() => setModalMultiChangeType('permanent')}>
                    <div className="modal-change-check" />
                    <div>
                      <div className="modal-change-title">Add to rotation</div>
                      <div className="modal-change-desc">This class becomes a permanent option for this period.</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </ResponsiveModal>
        )
      })()}
      {modal === 'period_time' && modalPeriodIdx !== null && (
        <ResponsiveModal
          isMobile={isMobile}
          open
          onClose={() => setModal(null)}
          title={`Change Time — Period ${periods[modalPeriodIdx]?.period_number}`}
          footer={
            <>
              <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn-save" onClick={savePeriodTimeOverride}>Save Change</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        </ResponsiveModal>
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
          <ResponsiveModal
            isMobile={isMobile}
            open
            onClose={() => setModal(null)}
            title="Change Lesson"
            footer={
              <>
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
              </>
            }
          >
            <div className="modal-sub">{effectiveCls?.label} — {curricula?.find(cu => cu.id === currId)?.name ?? 'No course'}</div>
            <div className="sch-lesson-picker-row" style={{display:'flex',alignItems:'center',gap:8,background:'#F5F5F5',borderRadius:6,padding:4}}>
              <button
                style={{width:32,height:32,borderRadius:6,border:'0.5px solid #E0E0E0',background:'#FFFFFF',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
                onClick={() => setModalLessonIdx(i => Math.max(0, i - 1))}
                disabled={modalLessonIdx === 0}
              ><ChevronLeft size={14} /></button>
              <span style={{flex:1,textAlign:'center',fontFamily:"'Figtree',sans-serif",fontSize:14,color:'#0A100D'}}>
                {currentModalLesson
                  ? [currentModalLesson.tag1, currentModalLesson.tag2].filter(Boolean).join(' · ')
                  : 'No lessons'}
              </span>
              <button
                style={{width:32,height:32,borderRadius:6,border:'0.5px solid #E0E0E0',background:'#FFFFFF',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
                onClick={() => setModalLessonIdx(i => Math.min(currLessons.length - 1, i + 1))}
                disabled={modalLessonIdx >= currLessons.length - 1}
              ><ChevronRight size={14} /></button>
            </div>
          </ResponsiveModal>
        )
      })()}

      {modal === 'date' && null}
    </>
  )
}