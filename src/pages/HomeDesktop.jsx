import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import { ChevronLeft, ChevronRight, ChevronDown, Play, ArrowRightLeft, Pencil, StickyNote } from 'lucide-react'

export default function HomeDesktop({
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
}) {
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

        <HintBanner id="home" message="Your daily dashboard. Tap any school, class, or time chip on a period card to make a quick change — you'll be asked if it applies just today or every future occurrence of that day of the week." />

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
          <div className="no-periods">
            <div style={{fontFamily:"'Figtree',sans-serif",fontSize:15,fontWeight:600,color:'#0A100D',marginBottom:6}}>No classes scheduled today.</div>
            <div style={{fontFamily:"'Figtree',sans-serif",fontSize:14,color:'#787878',lineHeight:1.6,marginBottom:16}}>Your schedule for this day hasn't been set up yet. Head to Schedule to add schools and classes to your regular week.</div>
            <button
              onClick={() => navigate('/schedule')}
              style={{height:32,padding:'0 14px',borderRadius:6,border:'0.5px solid #E0E0E0',background:'#FFFFFF',fontFamily:"'Figtree',sans-serif",fontSize:14,fontWeight:600,color:'#606060',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e => e.currentTarget.style.background='#F5F5F5'}
              onMouseLeave={e => e.currentTarget.style.background='#FFFFFF'}
            >
              Go to Schedule
            </button>
          </div>
        )}
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
          const hasOverride = period.frequency === 'alternating'
            ? !!(override?.school_id || override?.start_time || override?.end_time)
            : !!override

          return (
            <div
              key={period.id}
              className={`period-row ${isSelected ? 'selected' : ''} ${(!cls) ? 'no-class' : ''}`}
              onClick={() => setSelectedPeriodIdx(i)}
            >
              {/* Period label row */}
              <div className="period-header-row">
                <span className={`period-dot ${isSelected ? 'selected' : ''}`} />
                <span className="period-eyebrow">Period {period.period_number}</span>
                {hasOverride && <span className="period-special-badge">Special</span>}
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
                      start_time: effectiveStartTime?.slice(0,5) ?? '',
                      end_time: effectiveEndTime?.slice(0,5) ?? '',
                    })
                    setModalChangeType('once')
                    setModal('period_time')
                  }}>
                  {effectiveStartTime ? `${effectiveStartTime.slice(0,5)} – ${effectiveEndTime?.slice(0,5)}` : '—'}
                </button>
              </div>

              {/* Class + Lesson bar */}
              {period.frequency === 'alternating' ? (() => {
                const resolvedClassId = override?.class_id ?? null
                const resolvedCls = resolvedClassId ? allClasses.find(c => c.id === resolvedClassId) : null
                const resolvedLessons = lessons[resolvedCls?.curriculum_id] ?? []
                const resolvedLesson = resolvedLessons[lessonIndices[i] ?? 0]
                const openMultiModal = e => {
                  e.stopPropagation()
                  setSelectedPeriodIdx(i)
                  setModalPeriodIdx(i)
                  setModalOtherClassId(null)
                  setModalMultiChangeType('once')
                  setModal('multi_class')
                }
                return (
                  <div className="period-bar">
                    {resolvedCls ? (
                      <>
                        <button className="period-tap-chip class" onClick={openMultiModal}>
                          {resolvedCls.label}
                        </button>
                        {resolvedLesson && (
                          <span className="period-tap-chip" style={{cursor:'default'}}>
                            {[resolvedLesson.tag1, resolvedLesson.tag2].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </>
                    ) : (
                      <button className="period-tap-chip class empty" onClick={openMultiModal}>
                        Select Class
                      </button>
                    )}
                  </div>
                )
              })() : (
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
              )}
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
              <button className="edit-lesson-btn icon-only" title="Edit Lesson" onClick={() => navigate('/curriculum', {
                state: { lessonId: selectedLesson.id, curriculumId: selectedClass.curriculum_id }
              })}>
                <Pencil size={14} />
              </button>
              <button className="start-lesson-btn" onClick={() => navigate(`/runner/${selectedClass.id}/${selectedLesson.id}`)}>
                <Play size={14} /> Start Lesson
              </button>
            </div>
            <div className={`block-row memo-row ${memoExpanded ? 'open' : ''}`}>
              <div className="memo-row-header" onClick={() => setMemoExpanded(prev => !prev)}>
                <span className="block-title">Memo</span>
                <button className="memo-toggle-btn" onClick={e => { e.stopPropagation(); setMemoExpanded(prev => !prev) }}>
                  <StickyNote size={14} className={`memo-icon ${memoExpanded ? 'open' : ''}`} />
                </button>
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
}