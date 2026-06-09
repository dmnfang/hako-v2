import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import { Plus, Trash2, Copy, ChevronDown, X, GripVertical, ArrowLeft, ArrowRight, MoreHorizontal } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import './Curriculum.css'

export default function Curriculum() {
  const location = useLocation()

  const { curricula, refresh: refreshData } = useData()
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(null)
  const [lessons, setLessons] = useState([])
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [expandedBlocks, setExpandedBlocks] = useState({})
  const [copiedBlock, setCopiedBlock] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingBlock, setEditingBlock] = useState(null)
  const [editingLessonId, setEditingLessonId] = useState(null)
  const [lessonForm, setLessonForm] = useState({ tag1: '', tag2: '' })
  const [view, setView] = useState('lessons')
  const [lessonCounts, setLessonCounts] = useState({})
  const [openBlockMenuId, setOpenBlockMenuId] = useState(null)
  const [openLessonMenu, setOpenLessonMenu] = useState(false)
  const [openCourseMenu, setOpenCourseMenu] = useState(false)
  const [courseModal, setCourseModal] = useState(false)
  const [courseForm, setCourseForm] = useState({ name: '', grade_tag: '' })

  useEffect(() => { fetchCurricula() }, [])
  useEffect(() => { if (selectedCurriculumId) fetchLessons() }, [selectedCurriculumId])
  useEffect(() => { if (selectedLessonId && view === 'blocks') fetchBlocks() }, [selectedLessonId, view])

  useEffect(() => {
    function handleClick() { setOpenBlockMenuId(null) }
    if (openBlockMenuId) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
    }
    return () => document.removeEventListener('click', handleClick)
  }, [openBlockMenuId])

  useEffect(() => {
    function handleClick() { setOpenLessonMenu(false) }
    if (openLessonMenu) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
    }
    return () => document.removeEventListener('click', handleClick)
  }, [openLessonMenu])

  useEffect(() => {
    function handleClick() { setOpenCourseMenu(false) }
    if (openCourseMenu) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
    }
    return () => document.removeEventListener('click', handleClick)
  }, [openCourseMenu])

  async function fetchCurricula() {
    const { data: lessonData } = await supabase.from('lessons').select('id, curriculum_id')
    const counts = {}
    lessonData?.forEach(l => { counts[l.curriculum_id] = (counts[l.curriculum_id] ?? 0) + 1 })
    setLessonCounts(counts)
    if (location.state?.lessonId && location.state?.curriculumId) {
      setSelectedCurriculumId(location.state.curriculumId)
      setSelectedLessonId(location.state.lessonId)
      setView('blocks')
    } else if (curricula.length > 0 && !selectedCurriculumId) {
      setSelectedCurriculumId(curricula[0].id)
    }
    setLoading(false)
  }

  async function fetchLessons() {
    const { data } = await supabase
      .from('lessons').select('*').eq('curriculum_id', selectedCurriculumId).order('sort_order')
    setLessons(data ?? [])
    if (data?.length > 0) setSelectedLessonId(data[0].id)
    else setSelectedLessonId(null)
  }

  async function fetchBlocks() {
    const { data } = await supabase
      .from('blocks').select('*').eq('lesson_id', selectedLessonId).order('sort_order')
    setBlocks(data ?? [])
    if (data?.length > 0) setExpandedBlocks({ [data[0].id]: true })
    else setExpandedBlocks({})
  }

  async function saveCourse() {
    const { name, grade_tag } = courseForm
    if (!name.trim()) return
    const { data } = await supabase.from('curricula').insert({
      name: name.trim(),
      grade_tag: grade_tag.trim() || null,
    }).select().single()
    setCourseModal(false)
    setCourseForm({ name: '', grade_tag: '' })
    refreshData()
    if (data) setSelectedCurriculumId(data.id)
  }

  async function addLesson() {
    const maxSort = lessons.reduce((m, l) => Math.max(m, l.sort_order ?? 0), 0)
    const { data, error } = await supabase.from('lessons').insert({
      curriculum_id: selectedCurriculumId,
      title: 'New Lesson',
      sort_order: maxSort + 1
    }).select().single()
    if (error) { console.error(error); return }
    setLessons(prev => [...prev, data])
    setSelectedLessonId(data.id)
    setView('lessons')
    setEditingLessonId(data.id)
    setLessonForm({ tag1: '', tag2: '' })
    fetchCurricula()
  }

  async function saveLesson() {
    if (!editingLessonId) return
    const { tag1, tag2 } = lessonForm
    await supabase.from('lessons').update({
      tag1: tag1 || null,
      tag2: tag2 || null,
    }).eq('id', editingLessonId)
    setLessons(prev => prev.map(l => l.id === editingLessonId ? {
      ...l, tag1: tag1 || null, tag2: tag2 || null,
    } : l))
    setEditingLessonId(null)
    fetchCurricula()
    refreshData()
  }

  async function deleteLesson(id) {
    if (!confirm('Delete this lesson and all its blocks?')) return
    await supabase.from('lessons').delete().eq('id', id)
    setLessons(prev => prev.filter(l => l.id !== id))
    if (selectedLessonId === id) {
      const remaining = lessons.filter(l => l.id !== id)
      setSelectedLessonId(remaining[0]?.id ?? null)
    }
    setOpenLessonMenu(false)
    setView('lessons')
    fetchCurricula()
  }

  async function deleteCurriculum(id) {
    if (!confirm('Delete this course and all its lessons?')) return
    await supabase.from('curricula').delete().eq('id', id)
    setCurricula(prev => prev.filter(c => c.id !== id))
    if (selectedCurriculumId === id) {
      const remaining = curricula.filter(c => c.id !== id)
      setSelectedCurriculumId(remaining[0]?.id ?? null)
    }
    setOpenCourseMenu(false)
    fetchCurricula()
    refreshData()
  }

  async function addBlock() {
    if (!selectedLessonId) return
    const maxSort = blocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0)
    const { data } = await supabase.from('blocks').insert({
      lesson_id: selectedLessonId,
      title: 'New Block',
      content: '',
      sort_order: maxSort + 1
    }).select().single()
    setBlocks(prev => [...prev, data])
    setExpandedBlocks(prev => ({ ...prev, [data.id]: true }))
    setEditingBlock(data.id)
  }

  async function pasteBlock() {
    if (!copiedBlock || !selectedLessonId) return
    const maxSort = blocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0)
    const { data } = await supabase.from('blocks').insert({
      lesson_id: selectedLessonId,
      title: copiedBlock.title + ' (copy)',
      content: copiedBlock.content,
      sort_order: maxSort + 1
    }).select().single()
    setBlocks(prev => [...prev, data])
    setExpandedBlocks(prev => ({ ...prev, [data.id]: true }))
  }

  async function deleteBlock(id) {
    if (!confirm('Delete this block?')) return
    await supabase.from('blocks').delete().eq('id', id)
    setBlocks(prev => prev.filter(b => b.id !== id))
    setOpenBlockMenuId(null)
  }

  async function updateBlock(id, field, value) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  async function saveBlock(id) {
    const block = blocks.find(b => b.id === id)
    if (!block) return
    await supabase.from('blocks').update({ title: block.title, content: block.content }).eq('id', id)
    setEditingBlock(null)
  }

  function toggleBlock(id) {
    setExpandedBlocks(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function drillIntoLesson(lessonId) {
    setSelectedLessonId(lessonId)
    setView('blocks')
  }

  const selectedLesson = lessons.find(l => l.id === selectedLessonId)
  const selectedCurriculum = curricula.find(c => c.id === selectedCurriculumId)

  if (loading) return <Layout sidebar={<div />}><div /></Layout>

  const sidebar = (
    <div className="curr-sidebar">
      <div className="curr-count-box">
        <h1 className="curr-title">Courses</h1>
        <span>You currently have <strong>{curricula.length} active courses</strong></span>
        <HintBanner id="curriculum" message="Build your lesson plans here. Create courses, add lessons, and break each lesson into activity blocks. These plans appear on your Home dashboard when you tap a period." />
        <button className="curr-new-btn" onClick={() => { setCourseForm({ name: '', grade_tag: '' }); setCourseModal(true) }}><Plus size={14} /> New Course</button>
      </div>
      <div className="curr-list">
        {curricula.map(c => (
          <div
            key={c.id}
            className={`curr-row ${selectedCurriculumId === c.id ? 'selected' : ''}`}
            onClick={() => { setSelectedCurriculumId(c.id); setView('lessons') }}
          >
            <span className={`curr-dot ${selectedCurriculumId === c.id ? 'active' : ''}`} />
            <div className="curr-row-body">
              <div className="curr-row-top">
                <span className="curr-row-name">{c.name}</span>
                <span className="curr-row-count">{lessonCounts[c.id] ?? 0}</span>
              </div>
              {c.grade_tag && <span className="curr-grade-tag">{c.grade_tag}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Layout sidebar={sidebar}>
      <div className="curr-main">

        {/* ── LESSONS VIEW ── */}
        {view === 'lessons' && (
          <>
            <div className="curr-main-header">
              <span className="curr-main-title">{selectedCurriculum?.name}</span>
              <span className="curr-main-dot" />
              <span className="curr-main-sub">{lessons.length} Lessons</span>
              <div style={{ flex: 1 }} />
              <button className="curr-action-btn" onClick={addLesson}>
                <Plus size={14} /> New Lesson
              </button>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button className="curr-more-btn" onClick={() => setOpenCourseMenu(v => !v)}>
                  <MoreHorizontal size={14} />
                </button>
                {openCourseMenu && (
                  <div className="curr-block-menu">
                    <button className="curr-block-menu-item danger" onClick={() => deleteCurriculum(selectedCurriculumId)}>
                      <Trash2 size={14} /> Delete course
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="curr-lesson-list">
              {lessons.length === 0 && <div className="curr-empty">No lessons yet. Add one above.</div>}
              {lessons.map(l => (
                <div key={l.id} className="curr-lesson-row">
                  {editingLessonId === l.id ? (
                    <div className="curr-lesson-edit" onClick={e => e.stopPropagation()}>
                      <input
                        className="curr-lesson-edit-input"
                        placeholder="Tag 1 (e.g. Unit 1)"
                        value={lessonForm.tag1}
                        onChange={e => setLessonForm(p => ({ ...p, tag1: e.target.value }))}
                        autoFocus
                      />
                      <input
                        className="curr-lesson-edit-input"
                        placeholder="Tag 2 (e.g. Lesson 1)"
                        value={lessonForm.tag2}
                        onChange={e => setLessonForm(p => ({ ...p, tag2: e.target.value }))}
                      />
                      <button className="curr-action-btn" onClick={saveLesson}>Save</button>
                      <button className="curr-more-btn" onClick={() => setEditingLessonId(null)}>
                        <ArrowLeft size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <GripVertical size={14} className="curr-grip" />
                      <span className="curr-lesson-unit" onClick={() => drillIntoLesson(l.id)}>
                        {l.tag1 ?? '—'}
                      </span>
                      <span className="curr-lesson-sep" />
                      <span className="curr-lesson-name" onClick={() => drillIntoLesson(l.id)}>
                        {l.tag2 ?? 'Untitled'}
                      </span>
                      <div style={{ flex: 1 }} />
                      <button className="curr-lesson-arrow" onClick={() => drillIntoLesson(l.id)}>
                        <ArrowRight size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── BLOCKS VIEW ── */}
        {view === 'blocks' && (
          <>
            <div className="curr-main-header">
              <button className="curr-back-btn" onClick={() => { setView('lessons'); setEditingLessonId(null) }}>
                <ArrowLeft size={14} />
              </button>

              {editingLessonId === selectedLessonId ? (
                <>
                  <input
                    className="curr-lesson-edit-input"
                    placeholder="Tag 1 (e.g. Unit 1)"
                    value={lessonForm.tag1}
                    onChange={e => setLessonForm(p => ({ ...p, tag1: e.target.value }))}
                    autoFocus
                  />
                  <input
                    className="curr-lesson-edit-input wide"
                    placeholder="Tag 2 (e.g. Lesson 1)"
                    value={lessonForm.tag2}
                    onChange={e => setLessonForm(p => ({ ...p, tag2: e.target.value }))}
                  />
                  <button className="curr-action-btn" onClick={saveLesson}>Save</button>
                  <button className="curr-more-btn" onClick={() => setEditingLessonId(null)}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="curr-main-title">{selectedLesson?.tag1 ?? '—'}</span>
                  <span className="curr-main-dot" />
                  <span className="curr-main-sub">{selectedLesson?.tag2 ?? 'Untitled'}</span>
                  <span className="curr-main-dot" />
                  <span className="curr-main-sub">{blocks.length} Blocks</span>
                  <div style={{ flex: 1 }} />
                  <button className="curr-action-btn" onClick={addBlock}>
                    <Plus size={14} /> New Block
                  </button>
                  {copiedBlock && (
                    <button className="curr-action-btn" onClick={pasteBlock}>
                      <Copy size={14} /> Paste Block
                    </button>
                  )}
                  <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button className="curr-more-btn" onClick={() => setOpenLessonMenu(v => !v)}>
                      <MoreHorizontal size={14} />
                    </button>
                    {openLessonMenu && (
                      <div className="curr-block-menu">
                        <button
                          className="curr-block-menu-item"
                          onClick={() => {
                            setEditingLessonId(selectedLessonId)
                            setLessonForm({
                              tag1: selectedLesson?.tag1 ?? '',
                              tag2: selectedLesson?.tag2 ?? '',
                            })
                            setOpenLessonMenu(false)
                          }}
                        >
                          Edit lesson
                        </button>
                        <button
                          className="curr-block-menu-item danger"
                          onClick={() => deleteLesson(selectedLessonId)}
                        >
                          <Trash2 size={14} /> Delete lesson
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="curr-block-list">
              {blocks.length === 0 && <div className="curr-empty">No blocks yet. Add one above.</div>}
              {blocks.map(block => {
                const isOpen = expandedBlocks[block.id]
                const isEditing = editingBlock === block.id
                return (
                  <div key={block.id} className={`curr-block-row ${isOpen ? 'open' : ''}`}>
                    <div className="curr-block-header" onClick={() => toggleBlock(block.id)}>
                      <GripVertical size={14} className="curr-grip" />
                      {isEditing ? (
                        <input
                          className="curr-block-title-input"
                          value={block.title}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateBlock(block.id, 'title', e.target.value)}
                          onBlur={() => saveBlock(block.id)}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="curr-block-title"
                          onDoubleClick={e => { e.stopPropagation(); setEditingBlock(block.id) }}
                        >
                          {block.title}
                        </span>
                      )}
                      <button
                        className="curr-block-copy-btn"
                        onClick={e => { e.stopPropagation(); setCopiedBlock(block) }}
                      >
                        <Copy size={14} /> Copy Block
                      </button>
                      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                          className="curr-more-btn"
                          onClick={() => setOpenBlockMenuId(openBlockMenuId === block.id ? null : block.id)}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {openBlockMenuId === block.id && (
                          <div className="curr-block-menu">
                            <button
                              className="curr-block-menu-item"
                              onClick={() => { setEditingBlock(block.id); setOpenBlockMenuId(null) }}
                            >
                              Edit title
                            </button>
                            <button
                              className="curr-block-menu-item danger"
                              onClick={() => deleteBlock(block.id)}
                            >
                              <Trash2 size={14} /> Delete block
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        className="curr-block-chevron-btn"
                        onClick={e => { e.stopPropagation(); toggleBlock(block.id) }}
                      >
                        <ChevronDown size={14} className={`curr-block-chevron ${isOpen ? 'open' : ''}`} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="curr-block-body">
                        <textarea
                          className="curr-block-input"
                          value={block.content ?? ''}
                          placeholder="Add notes, steps, or instructions…"
                          onChange={e => updateBlock(block.id, 'content', e.target.value)}
                          onBlur={() => saveBlock(block.id)}
                          onClick={() => setEditingBlock(block.id)}
                          rows={4}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

      </div>
      {courseModal && (
        <div className="sc-modal-overlay" onClick={() => setCourseModal(false)}>
          <div className="sc-modal" onClick={e => e.stopPropagation()}>
            <div className="sc-modal-header">
              <span className="sc-modal-title">New Course</span>
              <button className="sc-modal-close" onClick={() => setCourseModal(false)}><X size={14} /></button>
            </div>
            <div className="sc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="sc-field">
                <span className="sc-field-label">COURSE NAME</span>
                <input
                  className="sc-input"
                  placeholder="e.g. Let's Try 1"
                  value={courseForm.name}
                  onChange={e => setCourseForm(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveCourse() }}
                  autoFocus
                />
              </div>
              <div className="sc-field">
                <span className="sc-field-label">GRADE TAG</span>
                <input
                  className="sc-input"
                  placeholder="e.g. Grade 3"
                  value={courseForm.grade_tag}
                  onChange={e => setCourseForm(p => ({ ...p, grade_tag: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveCourse() }}
                />
              </div>
            </div>
            <div className="sc-modal-footer">
              <button className="sc-form-cancel" onClick={() => setCourseModal(false)}>Cancel</button>
              <button className="sc-form-save" onClick={saveCourse}>Save</button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}