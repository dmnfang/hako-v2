import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import ResponsiveModal from '../components/ResponsiveModal'
import { useDaySchedule, toLocalDateStr, getDayStatus } from '../hooks/useDaySchedule'
import { GripVertical, ChevronLeft, ChevronRight, X, Play, ArrowLeft, Pencil, StickyNote, School, Users, Clock, BookOpen } from 'lucide-react'
import { useIsMobile } from '../hooks/useMediaQuery'
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
  const [screen, setScreen] = useState('list') // mobile only: 'list' | 'detail'
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

  async function savePeriodOverride() {
    const period = periods[modalPeriodIdx]
    if (modalSchoolId) await savePeriodSchoolOverrideHook(period, modalSchoolId, 0, modalChangeType, selectedDate)
    if (modalClassId) await savePeriodClassOverrideHook(period, modalClassId, 0, modalChangeType, selectedDate)
    if (modalTimeForm.start_time) await savePeriodTimeOverrideHook(period, modalTimeForm, 0, modalChangeType, selectedDate)
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

  if (loading) {
    return isMobile
      ? <div className="home-mobile" />
      : <Layout sidebar={<div />}><div /></Layout>
  }

  // Schools active today, derived once, shared by both layouts
  const dateBlockContent = (
    <>
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

      <button
        className={`home-status-chip home-status-${dayStatus.status}`}
        onClick={() => {
          setModalStatus(dayStatusOverride?.status ?? 'working')
          setModalStatusLabel(dayStatusOverride?.label ?? '')
          setModal('status')
        }}
      >
        <span className="home-status-dot" />
        {dayStatus.label}
      </button>

      <HintBanner id="home" message="Your daily dashboard. Tap any school, class, or time chip on a period card to make a quick change — you'll be asked if it applies just today or every future occurrence of that day of the week." />
    </>
  )

  const emptyPeriodsState = (
    <div className="no-periods">
      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:15,fontWeight:600,color:'#0A100D',marginBottom:6}}>No classes scheduled today.</div>
      <div style={{fontFamily:"'Figtree',sans-serif",fontSize:14,color:'#787878',lineHeight:1.6,marginBottom:16}}>Your schedule for this day hasn't been set up yet. Head to Schedule to add schools and classes to your regular week.</div>
      <button
        onClick={() => navigate('/schedule')}
        style={{height:32,padding:'0 14px',borderRadius:6,border:'0.5px solid #E0E0E0',background:'#FFFFFF',fontFamily:"'Figtree',sans-serif",fontSize:14,fontWeight:600,color:'#606060',cursor:'pointer',transition:'all 0.15s'}}
      >
        Go to Schedule
      </button>
    </div>
  )

  // ── Mobile layout ────────────────────────────────────────────────────
  const selectedPeriodSchool = isMobile ? (() => {
    if (!selectedPeriod) return null
    const override = periodOverrides[selectedPeriod.id]
    const slot0 = selectedPeriod.slots?.[0]
    const sid = override?.school_id ?? slot0?.school_id ?? selectedPeriod.school_id
    return schools.find(s => s.id === sid)
  })() : null

  const mobileLayout = (
      <div className="home-mobile">
        {screen === 'list' && (
          <div className="hm-screen">
            <div className="home-date-block hm-topbar-block">
              {dateBlockContent}
            </div>
            <div className="period-list hm-period-list">
              {!isWorkingDay && (
                <div className="no-periods">{dayStatus.label} — no classes scheduled.</div>
              )}
              {isWorkingDay && periods.length === 0 && emptyPeriodsState}
              {isWorkingDay && periods.map((period, i) => {
                const override = periodOverrides[period.id]
                const slot0 = period.slots?.[0]
                const effectiveSId = override?.school_id ?? slot0?.school_id ?? period.school_id
                const effectiveCId = override?.class_id ?? slot0?.class_id ?? slot0?.class?.id
                const effectiveStartTime = override?.start_time ?? slot0?.start_time
                const effectiveEndTime = override?.end_time ?? slot0?.end_time
                const cls = allClasses.find(c => c.id === effectiveCId)
                const periodSchool = schools.find(s => s.id === effectiveSId)
                const currLessons = lessons[cls?.curriculum_id] ?? []
                const lesson = currLessons[lessonIndices[i] ?? 0]
                const hasOverride = period.frequency === 'alternating'
                  ? !!(override?.school_id || override?.start_time || override?.end_time)
                  : !!override

                let classLabel = cls?.label ?? '—'
                let lessonLabel = lesson ? [lesson.tag1, lesson.tag2].filter(Boolean).join(' · ') : null
                if (period.frequency === 'alternating') {
                  const resolvedClassId2 = override?.class_id ?? null
                  const resolvedCls = resolvedClassId2 ? allClasses.find(c => c.id === resolvedClassId2) : null
                  if (resolvedCls) {
                    const resolvedLessons = lessons[resolvedCls.curriculum_id] ?? []
                    const resolvedLesson = resolvedLessons[lessonIndices[i] ?? 0]
                    classLabel = resolvedCls.label
                    lessonLabel = resolvedLesson ? [resolvedLesson.tag1, resolvedLesson.tag2].filter(Boolean).join(' · ') : null
                  } else {
                    classLabel = 'Select Class'
                    lessonLabel = null
                  }
                }

                return (
                  <div key={period.id} className="period-row" onClick={() => { setSelectedPeriodIdx(i); setScreen('detail') }}>
                    <div className="period-bar">
                      <div className="period-num-col">
                        <button
                          className="period-num-chip"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedPeriodIdx(i)
                            setModalPeriodIdx(i)
                            setModalSchoolId(effectiveSId)
                            setModalClassId(effectiveCId ?? null)
                            setModalTimeForm({ start_time: effectiveStartTime?.slice(0,5) ?? '', end_time: effectiveEndTime?.slice(0,5) ?? '' })
                            setModalChangeType('once')
                            setModal('period')
                          }}
                        >
                          Period {period.period_number}
                        </button>
                      </div>

                      <div className="period-info-col">
                        <div className="period-info-row">
                          {periodSchool && (
                            <span className="period-info-chip">
                              <School size={13} />
                              {periodSchool.name}
                            </span>
                          )}
                          {effectiveStartTime && (
                            <span className="period-info-chip">
                              <Clock size={13} />
                              {effectiveStartTime.slice(0,5)} – {effectiveEndTime?.slice(0,5)}
                            </span>
                          )}
                        </div>
                        <div className="period-info-row">
                          {classLabel && classLabel !== 'Select Class' ? (
                            <span className="period-info-chip">
                              <Users size={13} />
                              {classLabel}
                            </span>
                          ) : (
                            <span className="period-info-chip empty">
                              <Users size={13} />
                              Select Class
                            </span>
                          )}
                          {lessonLabel && (
                            <span className="period-info-chip">
                              <BookOpen size={13} />
                              <span className="period-lesson-tag">{lessonLabel}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {screen === 'detail' && selectedPeriod && (
          <div className="hm-screen">
            <div className="hm-detail-topbar">
              <button className="hm-back-btn" onClick={() => setScreen('list')}>
                <ArrowLeft size={20} />
              </button>
              <span className="hm-detail-subtitle">
                {selectedPeriodSchool?.name ?? '—'} · {selectedClass?.label ?? 'No class'}
              </span>
            </div>

            {selectedLesson ? (
              <>
                <div className="hm-lesson-bar">
                  <div className="hm-lesson-title-row">
                    <span className="hm-lesson-tag1">{selectedLesson.tag1 ?? '—'}</span>
                    <span className="lesson-title-dot" />
                    <span className="hm-lesson-tag2">{selectedLesson.tag2 ?? selectedLesson.title}</span>
                  </div>
                  <div className="hm-lesson-actions">
                    <button
                      className="hm-edit-btn"
                      onClick={() => navigate('/curriculum', {
                        state: { lessonId: selectedLesson.id, curriculumId: selectedClass.curriculum_id }
                      })}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="hm-start-btn"
                      onClick={() => navigate(`/runner/${selectedClass.id}/${selectedLesson.id}`)}
                    >
                      <Play size={16} /> Start Lesson
                    </button>
                    <button className="hm-nav-btn" onClick={() => navigateLesson(selectedPeriodIdx, -1)} disabled={selectedLessonIdx === 0}>
                      <ChevronLeft size={16} />
                    </button>
                    <button className="hm-nav-btn" onClick={() => navigateLesson(selectedPeriodIdx, 1)} disabled={selectedLessonIdx === selectedLessons.length - 1}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="block-list hm-block-list">
                  <div className={`block-row memo-row ${memoExpanded ? 'open' : ''}`}>
                    <div className="memo-row-header" onClick={() => setMemoExpanded(prev => !prev)}>
                      <StickyNote size={14} className="memo-icon" />
                      <span className="block-title">Memo</span>
                    </div>
                    {memoExpanded && (
                      <div className="memo-content-body">
                        {previousMemo && (
                          <div className="memo-previous">
                            <span className="memo-previous-label">Previous Lesson Memo</span>
                            <span className="memo-previous-text">{previousMemo.note}</span>
                          </div>
                        )}
                        <textarea
                          className="curr-block-input"
                          value={memoDraft}
                          placeholder="e.g. Didn't finish Let's Chant — vocab was too hard, slow down next time."
                          onChange={e => {
                            setMemoDraft(e.target.value)
                            e.target.style.height = 'auto'
                            e.target.style.height = `${e.target.scrollHeight}px`
                          }}
                          rows={3}
                        />
                        <button className="edit-lesson-btn memo-save-btn" onClick={saveMemo} disabled={!memoDraft.trim()}>
                          Save Memo
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedBlocks.length === 0 && <div className="no-blocks">No blocks in this lesson yet.</div>}
                  {selectedBlocks.map((block, i) => {
                    const key = `${selectedLesson.id}_${i}`
                    const isOpen = expandedBlocks[key]
                    return (
                      <div key={block.id} className={`block-row ${isOpen ? 'open' : ''}`}>
                        <div className="block-row-header" onClick={() => toggleBlock(key)}>
                          <span className="block-title">{block.title}</span>
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
            ) : isMultiClass && !resolvedClassId ? (
              <div
                className="no-lesson-selected multi-class-prompt"
                onClick={() => {
                  setModalPeriodIdx(selectedPeriodIdx)
                  setModalOtherClassId(null)
                  setModalMultiChangeType('once')
                  setModal('multi_class')
                }}
              >
                This period rotates between multiple classes. Tap <strong>Select Class</strong> to choose today's class.
              </div>
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
        )}

      </div>
  )

  // ── Desktop layout ───────────────────────────────────────────────────
  const sidebar = (
    <div className="home-sidebar">
      <div className="home-date-block">
        {dateBlockContent}
      </div>
      <div className="period-list">
        {!isWorkingDay && (
          <div className="no-periods">{dayStatus.label} — no classes scheduled.</div>
        )}
        {isWorkingDay && periods.length === 0 && emptyPeriodsState}
        {isWorkingDay && periods.map((period, i) => {
          const override = periodOverrides[period.id]
          const slot0 = period.slots?.[0]
          const effectiveSId = override?.school_id ?? slot0?.school_id ?? period.school_id
          const effectiveCId = override?.class_id ?? slot0?.class_id ?? slot0?.class?.id
          const effectiveStartTime = override?.start_time ?? slot0?.start_time
          const effectiveEndTime = override?.end_time ?? slot0?.end_time
          const cls = allClasses.find(c => c.id === effectiveCId)
          const periodSchool = schools.find(s => s.id === effectiveSId)
          const currLessons = lessons[cls?.curriculum_id] ?? []
          const lesson = currLessons[lessonIndices[i] ?? 0]
          const isSelected = i === selectedPeriodIdx
          return (
            <div
              key={period.id}
              className={`period-row ${isSelected ? 'selected' : ''} ${(!cls) ? 'no-class' : ''}`}
              onClick={() => setSelectedPeriodIdx(i)}
            >
              <div className="period-bar">
                <div className="period-num-col">
                  <button
                    className="period-num-chip"
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedPeriodIdx(i)
                      setModalPeriodIdx(i)
                      setModalSchoolId(effectiveSId)
                      setModalClassId(effectiveCId ?? null)
                      setModalTimeForm({ start_time: effectiveStartTime?.slice(0,5) ?? '', end_time: effectiveEndTime?.slice(0,5) ?? '' })
                      setModalChangeType('once')
                      setModal('period')
                    }}
                  >
                    Period {period.period_number}
                  </button>
                </div>

                <div className="period-info-col">
                  <div className="period-info-row">
                    {periodSchool && (
                      <span className="period-info-chip">
                        <School size={13} />
                        {periodSchool.name}
                      </span>
                    )}
                    {effectiveStartTime && (
                      <span className="period-info-chip">
                        <Clock size={13} />
                        {effectiveStartTime.slice(0,5)} – {effectiveEndTime?.slice(0,5)}
                      </span>
                    )}
                  </div>

                  <div className="period-info-row">
                    {period.frequency === 'alternating' ? (() => {
                      const resolvedClassId = override?.class_id ?? null
                      const resolvedCls = resolvedClassId ? allClasses.find(c => c.id === resolvedClassId) : null
                      const resolvedLessons = lessons[resolvedCls?.curriculum_id] ?? []
                      const resolvedLesson = resolvedLessons[lessonIndices[i] ?? 0]
                      return resolvedCls ? (
                        <>
                          <span className="period-info-chip">
                            <Users size={13} />
                            {resolvedCls.label}
                          </span>
                          {resolvedLesson && (
                            <span className="period-info-chip">
                              <BookOpen size={13} />
                              <span className="period-lesson-tag">{resolvedLesson.tag1}</span>
                              {resolvedLesson.tag2 && (
                                <><span className="period-lesson-dot" /><span className="period-lesson-tag">{resolvedLesson.tag2}</span></>
                              )}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="period-info-chip empty">
                          <Users size={13} />
                          Select Class
                        </span>
                      )
                    })() : (
                      <>
                        {cls ? (
                          <span className="period-info-chip">
                            <Users size={13} />
                            {cls.label}
                          </span>
                        ) : (
                          <span className="period-info-chip empty">
                            <Users size={13} />
                            Select Class
                          </span>
                        )}
                        {cls && lesson && (
                          <span className="period-info-chip">
                            <BookOpen size={13} />
                            <span className="period-lesson-tag">{lesson.tag1}</span>
                            {lesson.tag2 && (
                              <><span className="period-lesson-dot" /><span className="period-lesson-tag">{lesson.tag2}</span></>
                            )}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const desktopLayout = (
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
                <button className="edit-lesson-btn icon-only" title="Edit Lesson" onClick={() => navigate('/curriculum', {
                  state: { lessonId: selectedLesson.id, curriculumId: selectedClass.curriculum_id }
                })}>
                  <Pencil size={14} />
                </button>
                <button className="start-lesson-btn" onClick={() => navigate(`/runner/${selectedClass.id}/${selectedLesson.id}`)}>
                  <Play size={14} /> Start Lesson
                </button>
                <div className="lesson-nav">
                  <button className="lesson-nav-btn" onClick={() => navigateLesson(selectedPeriodIdx, -1)} disabled={selectedLessonIdx === 0}>
                    <ChevronLeft size={14} />
                  </button>
                  <button className="lesson-nav-btn" onClick={() => navigateLesson(selectedPeriodIdx, 1)} disabled={selectedLessonIdx === selectedLessons.length - 1}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <div className={`block-row memo-row ${memoExpanded ? 'open' : ''}`}>
                <div className="memo-row-header" onClick={() => setMemoExpanded(prev => !prev)}>
                  <StickyNote size={14} className="memo-icon" />
                  <span className="block-title">Memo</span>
                </div>
                {memoExpanded && (
                  <div className="memo-content-body">
                    {previousMemo && (
                      <div className="memo-previous">
                        <span className="memo-previous-label">Previous Lesson Memo</span>
                        <span className="memo-previous-text">{previousMemo.note}</span>
                      </div>
                    )}
                    <textarea
                      className="curr-block-input"
                      value={memoDraft}
                      placeholder="e.g. Didn't finish Let's Chant — vocab was too hard, slow down next time."
                      onChange={e => {
                        setMemoDraft(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = `${e.target.scrollHeight}px`
                      }}
                      rows={3}
                    />
                    <button className="edit-lesson-btn memo-save-btn" onClick={saveMemo} disabled={!memoDraft.trim()}>
                      Save Memo
                    </button>
                  </div>
                )}
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
          ) : isMultiClass && selectedPeriod && !resolvedClassId ? (
            <div
              className="no-lesson-selected multi-class-prompt"
              onClick={() => {
                setModalPeriodIdx(selectedPeriodIdx)
                setModalOtherClassId(null)
                setModalMultiChangeType('once')
                setModal('multi_class')
              }}
            >
              This period rotates between multiple classes. Tap <strong>Select Class</strong> to choose today's class.
            </div>
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
      </Layout>
  )

  return (
    <>
      <ErrorBoundary>
        {isMobile ? mobileLayout : desktopLayout}
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
      {/* ── Consolidated Period Modal ── */}
      {modal === 'period' && modalPeriodIdx !== null && (() => {
        const period = periods[modalPeriodIdx]
        const schoolClasses = allClasses.filter(cl => cl.school_id === modalSchoolId)
        return (
          <ResponsiveModal
            isMobile={isMobile}
            open
            onClose={() => setModal(null)}
            title={`Period ${period?.period_number}`}
            footer={
              <>
                <button className="modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button className="modal-btn-save" onClick={savePeriodOverride}>Save</button>
              </>
            }
          >
            <div className="modal-label modal-label-spaced">School</div>
            <div className="modal-chips">
              {schools.map(s => (
                <button
                  key={s.id}
                  className={`modal-chip ${modalSchoolId === s.id ? 'active' : ''}`}
                  onClick={() => {
                    setModalSchoolId(s.id)
                    setModalClassId(null)
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="modal-label modal-label-spaced">Class</div>
            <div className="modal-chips">
              {schoolClasses.length === 0 ? (
                <span className="modal-empty-hint">Select a school first</span>
              ) : schoolClasses.map(cl => (
                <button
                  key={cl.id}
                  className={`modal-chip ${modalClassId === cl.id ? 'active' : ''}`}
                  onClick={() => setModalClassId(cl.id)}
                >
                  {cl.label}
                </button>
              ))}
            </div>

            <div className="modal-label modal-label-spaced">Time</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="modal-field" style={{ flex: 1 }}>
                <span className="modal-field-label">START</span>
                <input className="modal-label-input" type="time" value={modalTimeForm.start_time} onChange={e => setModalTimeForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="modal-field" style={{ flex: 1 }}>
                <span className="modal-field-label">END</span>
                <input className="modal-label-input" type="time" value={modalTimeForm.end_time} onChange={e => setModalTimeForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>

            <div className="modal-label modal-label-spaced">What kind of change?</div>
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