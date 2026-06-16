import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight, X, GripVertical, Check, LogOut, StickyNote } from 'lucide-react'
import './Runner.css'

function formatTime(seconds) {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function Runner() {
  const { classId, lessonId } = useParams()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState(null)
  const [curriculum, setCurriculum] = useState(null)
  const [school, setSchool] = useState(null)
  const [cls, setCls] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0)
  const [completedBlocks, setCompletedBlocks] = useState(new Set())
  const [blockElapsed, setBlockElapsed] = useState(0)
  const [globalRemaining, setGlobalRemaining] = useState(null)
  const [blockTimes, setBlockTimes] = useState({})
  const [loading, setLoading] = useState(true)
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  const [memoOpen, setMemoOpen] = useState(false)
  const [previousMemo, setPreviousMemo] = useState(null)
  const [currentMemo, setCurrentMemo] = useState(null)
  const [memoDraft, setMemoDraft] = useState('')
  const [memoSaved, setMemoSaved] = useState(false)

  const blockStartRef = useRef(null)
  const periodEndRef = useRef(null)
  const blockTimerRef = useRef(null)
  const globalTimerRef = useRef(null)
  const blockTimesRef = useRef({})
  const currentBlockIdxRef = useRef(0)
  const blockElapsedRef = useRef(0)
  const blocksRef = useRef([])

  useEffect(() => {
    fetchData()
    return () => {
      clearInterval(blockTimerRef.current)
      clearInterval(globalTimerRef.current)
    }
  }, [])

  async function fetchData() {
    const [
      { data: lessonData },
      { data: blockData },
      { data: slotData },
      { data: classData }
    ] = await Promise.all([
      supabase.from('lessons').select('*, curriculum:curricula(*)').eq('id', lessonId).single(),
      supabase.from('blocks').select('*').eq('lesson_id', lessonId).order('sort_order'),
      supabase.from('period_slots').select('period:periods(end_time)').eq('class_id', classId).maybeSingle(),
      supabase.from('classes').select('*, school:schools(*)').eq('id', classId).single()
    ])

    setLesson(lessonData)
    setCurriculum(lessonData?.curriculum)
    setCls(classData)
    setSchool(classData?.school)

    const loaded = blockData ?? []
    setBlocks(loaded)
    blocksRef.current = loaded

    const endTimeStr = slotData?.period?.end_time
    if (endTimeStr) {
      const [h, m] = endTimeStr.split(':').map(Number)
      const end = new Date()
      end.setHours(h, m, 0, 0)
      periodEndRef.current = end
      setGlobalRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)))
      startGlobalTimer()
    }

    setLoading(false)
    startBlockTimer()
    fetchPreviousMemo(lessonData)
  }

  async function fetchPreviousMemo(lessonData) {
    if (!lessonData?.curriculum_id) return
    const { data: allLessons } = await supabase
      .from('lessons')
      .select('id, sort_order')
      .eq('curriculum_id', lessonData.curriculum_id)
      .order('sort_order')
    if (!allLessons) return
    const currentIdx = allLessons.findIndex(l => l.id === lessonId)
    const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null
    if (!prevLesson) { setPreviousMemo(null) } else {
      const { data } = await supabase
        .from('teaching_log')
        .select('*')
        .eq('lesson_id', prevLesson.id)
        .eq('class_id', classId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPreviousMemo(data ?? null)
    }
    fetchCurrentMemo()
  }

  async function fetchCurrentMemo() {
    const { data } = await supabase
      .from('teaching_log')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCurrentMemo(data ?? null)
    setMemoDraft(data?.note ?? '')
  }

  async function saveMemo() {
    if (!memoDraft.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('teaching_log').insert({
      user_id: user.id,
      lesson_id: lessonId,
      class_id: classId,
      taught_on: new Date().toISOString().slice(0, 10),
      note: memoDraft.trim(),
    })
    setMemoOpen(false)
    setMemoSaved(true)
    fetchCurrentMemo()
    setTimeout(() => setMemoSaved(false), 1000)
  }

  function startBlockTimer() {
    clearInterval(blockTimerRef.current)
    blockElapsedRef.current = 0
    setBlockElapsed(0)
    blockStartRef.current = Date.now()
    blockTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - blockStartRef.current) / 1000)
      blockElapsedRef.current = elapsed
      setBlockElapsed(elapsed)
    }, 1000)
  }

  function startGlobalTimer() {
    clearInterval(globalTimerRef.current)
    globalTimerRef.current = setInterval(() => {
      if (!periodEndRef.current) return
      const remaining = Math.max(0, Math.floor((periodEndRef.current - Date.now()) / 1000))
      setGlobalRemaining(remaining)
      if (remaining === 0) clearInterval(globalTimerRef.current)
    }, 1000)
  }

  function saveCurrentBlockTime() {
    const block = blocksRef.current[currentBlockIdxRef.current]
    if (block && blockElapsedRef.current > 0) {
      blockTimesRef.current = { ...blockTimesRef.current, [block.id]: blockElapsedRef.current }
      setBlockTimes({ ...blockTimesRef.current })
    }
  }

  function goToBlock(idx) {
    saveCurrentBlockTime()
    const newCompleted = new Set()
    for (let i = 0; i < idx; i++) newCompleted.add(i)
    setCompletedBlocks(newCompleted)
    currentBlockIdxRef.current = idx
    setCurrentBlockIdx(idx)
    startBlockTimer()
  }

  function prevBlock() {
    if (currentBlockIdxRef.current > 0) {
      goToBlock(currentBlockIdxRef.current - 1)
    }
  }

  async function nextBlock() {
    const isLast = currentBlockIdxRef.current === blocksRef.current.length - 1
    if (isLast) {
      await finishLesson()
    } else {
      goToBlock(currentBlockIdxRef.current + 1)
    }
  }

  async function finishLesson() {
    saveCurrentBlockTime()
    clearInterval(blockTimerRef.current)
    clearInterval(globalTimerRef.current)

    // Save block times
    const times = { ...blockTimesRef.current }
    for (const [blockId, elapsed] of Object.entries(times)) {
      if (elapsed > 0) {
        await supabase.from('blocks').update({ last_duration_seconds: elapsed }).eq('id', blockId)
      }
    }

    // Find next lesson and advance class_progress
    const { data: allLessons } = await supabase
      .from('lessons')
      .select('id, sort_order')
      .eq('curriculum_id', lesson.curriculum_id)
      .order('sort_order')

    if (allLessons) {
      const currentIdx = allLessons.findIndex(l => l.id === lessonId)
      const nextLesson = allLessons[currentIdx + 1]
      if (nextLesson) {
        await supabase.from('class_progress').upsert({
          class_id: classId,
          current_lesson_id: nextLesson.id
        }, { onConflict: 'class_id' })
      }
    }

    navigate('/home')
  }

  async function exitRunner() {
    saveCurrentBlockTime()
    clearInterval(blockTimerRef.current)
    clearInterval(globalTimerRef.current)
    const times = { ...blockTimesRef.current }
    for (const [blockId, elapsed] of Object.entries(times)) {
      if (elapsed > 0) {
        await supabase.from('blocks').update({ last_duration_seconds: elapsed }).eq('id', blockId)
      }
    }
    navigate('/home')
  }

  function handleDragStart(e, idx) {
    if (completedBlocks.has(idx) || idx === currentBlockIdx) { e.preventDefault(); return }
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    if (completedBlocks.has(idx)) return
    setDragOverIdx(idx)
  }

  function handleDrop(e, idx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx || completedBlocks.has(idx)) return

    const next = [...blocksRef.current]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)

    let newActive = currentBlockIdxRef.current
    if (dragIdx === currentBlockIdxRef.current) {
      newActive = idx
    } else if (dragIdx < currentBlockIdxRef.current && idx >= currentBlockIdxRef.current) {
      newActive = currentBlockIdxRef.current - 1
    } else if (dragIdx > currentBlockIdxRef.current && idx <= currentBlockIdxRef.current) {
      newActive = currentBlockIdxRef.current + 1
    }

    blocksRef.current = next
    setBlocks(next)
    currentBlockIdxRef.current = newActive
    setCurrentBlockIdx(newActive)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  function handleDragEnd() {
    setDragIdx(null)
    setDragOverIdx(null)
  }

  if (loading) return <div className="runner-loading">Loading...</div>

  const currentBlock = blocks[currentBlockIdx]
  const isLastBlock = currentBlockIdx === blocks.length - 1

  return (
    <div className="runner-shell">

      <div className="runner-header">
        <div className="runner-header-left">
          <span className="runner-school">{school?.name ?? '—'}</span>
          <span className="runner-header-dot" />
          <span className="runner-class">{cls?.label ?? '—'}</span>
        </div>
        <div className="runner-header-right">
          <div className={`runner-global-timer ${globalRemaining !== null && globalRemaining < 300 ? 'warning' : ''}`}>
            {globalRemaining !== null ? formatTime(globalRemaining) : '--:--'}
          </div>
          <button className="runner-nav-btn" onClick={prevBlock} disabled={currentBlockIdx === 0}>
            <ChevronLeft size={14} />
          </button>
          {isLastBlock ? (
            <button className="runner-nav-btn finish" onClick={nextBlock}>
              <Check size={14} />
            </button>
          ) : (
            <button className="runner-nav-btn" onClick={nextBlock}>
              <ChevronRight size={14} />
            </button>
          )}
          <button className={`runner-memo-btn ${previousMemo ? 'has-memo' : ''} ${memoSaved ? 'saved' : ''}`} onClick={() => setMemoOpen(prev => !prev)}>
            <StickyNote size={14} />
          </button>
          <button className="runner-exit-btn" onClick={exitRunner}>
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {memoOpen && (
        <div className="runner-memo-panel">
          {previousMemo && (
            <div className="memo-previous">
              <span className="memo-previous-label">Previous Lesson Memo</span>
              <span className="memo-previous-text">{previousMemo.note}</span>
            </div>
          )}
          {currentMemo && <span className="memo-current-label">This Lesson's Memo</span>}
          <textarea
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
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
          <button className="memo-save-btn" onClick={saveMemo} disabled={!memoDraft.trim()}>
            Save Memo
          </button>
        </div>
      )}

      <div className="runner-body">

        <div className="runner-block-list">
          <div className="runner-block-list-header">
            <span className="runner-lesson-curriculum">{curriculum?.name}</span>
            <span className="runner-lesson-dot" />
            <span className="runner-lesson-unit">{lesson?.tag1 ?? '—'}</span>
            <span className="runner-lesson-dot" />
            <span className="runner-lesson-num">{lesson?.tag2 ?? lesson?.title}</span>
          </div>
          <div className="runner-block-items">
            {blocks.map((block, i) => {
              const isActive = i === currentBlockIdx
              const isDone = completedBlocks.has(i)
              const isDragging = dragIdx === i
              const isDragOver = dragOverIdx === i
              const draggable = !isDone && !isActive

              return (
                <div
                  key={block.id}
                  className={`runner-block-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  onClick={() => goToBlock(i)}
                  draggable={draggable}
                  onDragStart={e => handleDragStart(e, i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={e => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                >
                  {draggable && <GripVertical size={14} className="runner-block-grip" />}
                  <span className="runner-block-item-title">{block.title}</span>
                  {blockTimes[block.id] > 0 && (
                    <span className="runner-block-item-time">{formatTime(blockTimes[block.id])}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="runner-active">
          <div className="runner-active-header">
            <span className="runner-active-title">{currentBlock?.title}</span>
            <span className="runner-block-timer">{formatTime(blockElapsed)}</span>
          </div>
          <div className="runner-active-body">
            {currentBlock?.content
              ? currentBlock.content.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} className="runner-content-line">
                    <span className="runner-bullet">•</span>
                    <span>{line.replace(/^[-•]\s*/, '')}</span>
                  </div>
                ))
              : <span className="runner-empty">No content for this block.</span>
            }
          </div>
        </div>

      </div>
    </div>
  )
}