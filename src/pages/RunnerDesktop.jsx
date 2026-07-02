import { ChevronLeft, ChevronRight, X, GripVertical, Check, CheckCheck, LogOut, StickyNote } from 'lucide-react'

export default function RunnerDesktop({
  school, cls, curriculum, lesson, blocks,
  currentBlockIdx, completedBlocks, blockElapsed, globalRemaining, blockTimes,
  dragIdx, dragOverIdx, handleDragStart, handleDragOver, handleDrop, handleDragEnd,
  goToBlock, prevBlock, nextBlock, exitRunner, finishLesson,
  memoOpen, setMemoOpen, previousMemo, currentMemo, memoDraft, setMemoDraft, saveMemo, memoSaved,
  formatTime,
}) {
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
          <button className="runner-mark-done-btn" onClick={finishLesson}>
            <CheckCheck size={14} /> Mark Done
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