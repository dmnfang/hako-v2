import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Play, Pencil, StickyNote, ArrowRightLeft, ArrowLeft } from 'lucide-react'
import BottomDrawer from '../components/BottomDrawer'
import HintBanner from '../components/HintBanner'

export default function HomeMobile({
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
  // 'list' = Level 1 (period list), 'detail' = Level 2 (lesson detail)
  const [screen, setScreen] = useState('list')

  function openPeriod(i) {
    setSelectedPeriodIdx(i)
    setScreen('detail')
  }

  const selectedPeriodSchool = (() => {
    if (!selectedPeriod) return null
    const override = periodOverrides[selectedPeriod.id]
    const slot0 = selectedPeriod.slots?.[0]
    const sid = override?.school_id ?? slot0?.school_id ?? selectedPeriod.school_id
    return schools.find(s => s.id === sid)
  })()

  return (
    <div className="home-mobile">
      <div style={{background:'lime',color:'black',fontSize:20,fontWeight:'bold',padding:20,textAlign:'center'}}>
        HOME MOBILE IS RENDERING — screen: {screen}
      </div>
      {screen === 'list' && (
        <div className="hm-screen">
          <div className="hm-topbar">
            <div className="hm-date-line">
              <span className="hm-dow">{dow},</span>
              <span className="hm-date">{dateStr}</span>
            </div>
            <button
              className="hm-status-chip-btn"
              onClick={() => {
                setModalStatus(dayStatusOverride?.status ?? 'working')
                setModalStatusLabel(dayStatusOverride?.label ?? '')
                setModal('status')
              }}
            >
              <span className={`hm-status-dot home-status-${dayStatus.status}`} />
              {dayStatus.label}
            </button>
          </div>

          <HintBanner id="home_mobile" message="Tap a period to see its lesson plan. Tap any chip on a card to make a quick change." />

          <div className="hm-period-list">
            {!isWorkingDay && (
              <div className="no-periods">{dayStatus.label} — no classes scheduled.</div>
            )}
            {isWorkingDay && periods.length === 0 && (
              <div className="no-periods">
                <div className="hm-empty-title">No classes scheduled today.</div>
                <div className="hm-empty-desc">Your schedule for this day hasn't been set up yet. Head to Schedule to add schools and classes to your regular week.</div>
                <button className="hm-empty-btn" onClick={() => navigate('/schedule')}>Go to Schedule</button>
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
                <button key={period.id} className="hm-period-card" onClick={() => openPeriod(i)}>
                  <div className="hm-period-card-top">
                    <span className="hm-period-eyebrow">Period {period.period_number}</span>
                    {hasOverride && <span className="period-special-badge">Special</span>}
                  </div>
                  <div className="hm-period-card-main">
                    <span className="hm-period-school">{periodSchool?.name ?? '—'}</span>
                    <span className="hm-period-dot" />
                    <span className="hm-period-time">
                      {effectiveStartTime ? `${effectiveStartTime.slice(0,5)} – ${effectiveEndTime?.slice(0,5)}` : '—'}
                    </span>
                  </div>
                  <div className="hm-period-card-sub">
                    <span className="hm-period-class">{classLabel}</span>
                    {lessonLabel && (
                      <>
                        <span className="hm-period-dot" />
                        <span className="hm-period-lesson">{lessonLabel}</span>
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {screen === 'detail' && selectedPeriod && (
        <div className="hm-screen">
          <div className="hm-detail-topbar">
            <button className="hm-back-btn" onClick={() => setScreen('list')}>
              <ArrowLeft size={16} />
            </button>
            <span className="hm-detail-subtitle">
              {selectedPeriodSchool?.name ?? '—'} · {selectedClass?.label ?? 'No class'}
            </span>
            <button
              className="hm-memo-icon-btn"
              onClick={() => setMemoExpanded(true)}
            >
              <StickyNote size={16} className={previousMemo ? 'has-memo' : ''} />
            </button>
          </div>

          {selectedLesson ? (
            <>
              <div className="hm-lesson-nav-row">
                <button className="lesson-nav-btn" onClick={() => navigateLesson(selectedPeriodIdx, -1)} disabled={selectedLessonIdx === 0}>
                  <ChevronLeft size={14} />
                </button>
                <div className="hm-lesson-title-group">
                  <span className="lesson-main-title">{selectedLesson.tag1 ?? '—'}</span>
                  <span className="lesson-sub-title">{selectedLesson.tag2 ?? selectedLesson.title}</span>
                </div>
                <button className="lesson-nav-btn" onClick={() => navigateLesson(selectedPeriodIdx, 1)} disabled={selectedLessonIdx === selectedLessons.length - 1}>
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="hm-block-list">
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

              <div className="hm-bottom-bar">
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

      {/* Memo drawer */}
      <BottomDrawer
        open={memoExpanded}
        onClose={() => setMemoExpanded(false)}
        title="Memo"
        footer={
          <button className="hm-drawer-save-btn" onClick={() => { saveMemo(); setMemoExpanded(false) }} disabled={!memoDraft.trim()}>
            Save Memo
          </button>
        }
      >
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
      </BottomDrawer>
    </div>
  )
}