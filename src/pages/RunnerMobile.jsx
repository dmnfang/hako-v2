import { useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, X, Check, LogOut, StickyNote, List } from 'lucide-react'
import BottomDrawer from '../components/BottomDrawer'

export default function RunnerMobile({
  school, cls, curriculum, lesson, blocks,
  currentBlockIdx, completedBlocks, blockElapsed, globalRemaining, blockTimes,
  goToBlock, prevBlock, nextBlock, exitRunner,
  memoOpen, setMemoOpen, previousMemo, currentMemo, memoDraft, setMemoDraft, saveMemo,
  formatTime,
}) {
  const [blockListOpen, setBlockListOpen] = useState(false)
  const currentBlock = blocks[currentBlockIdx]
  const isLastBlock = currentBlockIdx === blocks.length - 1

  return (
    <div className="runner-mobile">

      <div className="rm-topbar">
        <button className="rm-back-btn" onClick={exitRunner}>
          <ArrowLeft size={16} />
        </button>
        <span className="rm-topbar-subtitle">
          {school?.name ?? '—'} · {cls?.label ?? '—'}
        </span>
        <div className={`rm-global-timer ${globalRemaining !== null && globalRemaining < 300 ? 'warning' : ''}`}>
          {globalRemaining !== null ? formatTime(globalRemaining) : '--:--'}
        </div>
      </div>

      <div className="rm-active-header">
        <p className="rm-block-title">{currentBlock?.title ?? '—'}</p>
        <span className="rm-block-timer">{formatTime(blockElapsed)}</span>
      </div>

      <div className="rm-active-body">
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

      <div className="rm-bottom-bar">
        <div className="rm-bottom-bar-left">
          <button className="rm-icon-btn" onClick={() => setBlockListOpen(true)}>
            <List size={16} />
          </button>
          <button
            className={`rm-icon-btn ${previousMemo ? 'has-memo' : ''}`}
            onClick={() => setMemoOpen(true)}
          >
            <StickyNote size={16} />
          </button>
        </div>
        <div className="rm-bottom-bar-right">
          <button className="rm-icon-btn" onClick={prevBlock} disabled={currentBlockIdx === 0}>
            <ChevronLeft size={16} />
          </button>
          <span className="rm-block-count">{currentBlockIdx + 1} of {blocks.length}</span>
          <button className={`rm-icon-btn ${isLastBlock ? 'finish' : ''}`} onClick={nextBlock}>
            {isLastBlock ? <Check size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* Block list drawer */}
      <BottomDrawer
        open={blockListOpen}
        onClose={() => setBlockListOpen(false)}
        title={[lesson?.tag1, lesson?.tag2 ?? lesson?.title].filter(Boolean).join(' · ')}
      >
        <div className="rm-block-drawer-list">
          {blocks.map((block, i) => {
            const isActive = i === currentBlockIdx
            const isDone = completedBlocks.has(i)
            return (
              <div
                key={block.id}
                className={`runner-block-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                onClick={() => { goToBlock(i); setBlockListOpen(false) }}
              >
                <span className="runner-block-item-title">{block.title}</span>
                {blockTimes[block.id] > 0 && (
                  <span className="runner-block-item-time">{formatTime(blockTimes[block.id])}</span>
                )}
              </div>
            )
          })}
        </div>
      </BottomDrawer>

      {/* Memo drawer */}
      <BottomDrawer
        open={memoOpen}
        onClose={() => setMemoOpen(false)}
        title="Memo"
        footer={
          <button className="hm-drawer-save-btn" onClick={saveMemo} disabled={!memoDraft.trim()}>
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
      </BottomDrawer>
    </div>
  )
}