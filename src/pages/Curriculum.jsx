import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import { Plus, Trash2, Copy, ChevronDown, X, GripVertical, ArrowLeft, ArrowRight, MoreHorizontal, Pencil } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import './Curriculum.css'

const BLOCK_GROUPS = [
  { value: 'activities', label: 'Activities' },
  { value: 'songs_chants', label: 'Songs & Chants' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'games', label: 'Games' },
  { value: 'routines', label: 'Routines' },
]

const SERIES_TAGS = [
  { value: 'all', label: 'All' },
  { value: 'lets_try', label: "Let's Try" },
  { value: 'new_horizon', label: 'New Horizon' },
  { value: 'original', label: 'Original' },
]

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
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [dragLessonId, setDragLessonId] = useState(null)
  const [dragOverLessonId, setDragOverLessonId] = useState(null)
  const [dragBlockId, setDragBlockId] = useState(null)
  const [dragOverBlockId, setDragOverBlockId] = useState(null)

  // ─── Lesson Blocks library ──────────────────────────────────────────────
  const [pageMode, setPageMode] = useState('plans') // 'plans' | 'library'
  const [selectedGroup, setSelectedGroup] = useState('activities')
  const [seriesFilter, setSeriesFilter] = useState('all')
  const [libraryBlocks, setLibraryBlocks] = useState([])
  const [libraryCounts, setLibraryCounts] = useState({})
  const [expandedLibraryBlocks, setExpandedLibraryBlocks] = useState({})
  const [editingLibraryBlock, setEditingLibraryBlock] = useState(null)
  const [openLibraryMenuId, setOpenLibraryMenuId] = useState(null)
  const [dragLibraryId, setDragLibraryId] = useState(null)
  const [dragOverLibraryId, setDragOverLibraryId] = useState(null)

  // ─── Insert Blocks modal (within lesson editor) ─────────────────────────
  const [insertModal, setInsertModal] = useState(false)
  const [insertGroup, setInsertGroup] = useState('activities')
  const [insertSeries, setInsertSeries] = useState('all')
  const [insertBlocks, setInsertBlocks] = useState([]) // library blocks for insertGroup
  const [insertSelectedIds, setInsertSelectedIds] = useState([])

  useEffect(() => { fetchCurricula() }, [])
  useEffect(() => { if (selectedCurriculumId) fetchLessons() }, [selectedCurriculumId])
  useEffect(() => { if (selectedLessonId && view === 'blocks') fetchBlocks() }, [selectedLessonId, view])
  useEffect(() => { if (pageMode === 'library') fetchLibraryBlocks() }, [pageMode, selectedGroup])
  useEffect(() => { if (pageMode === 'library') fetchLibraryCounts() }, [pageMode])
  useEffect(() => { if (insertModal) fetchInsertBlocks() }, [insertModal, insertGroup])

  useEffect(() => {
    function handleClick() { setOpenLibraryMenuId(null) }
    if (openLibraryMenuId) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
    }
    return () => document.removeEventListener('click', handleClick)
  }, [openLibraryMenuId])

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
    setExpandedBlocks({})
  }

  // ─── Lesson Blocks library ──────────────────────────────────────────────
  async function fetchLibraryBlocks() {
    const { data } = await supabase
      .from('lesson_blocks').select('*').eq('block_group', selectedGroup).order('sort_order')
    setLibraryBlocks(data ?? [])
    setExpandedLibraryBlocks({})
  }

  async function fetchLibraryCounts() {
    const { data } = await supabase.from('lesson_blocks').select('block_group')
    const counts = {}
    data?.forEach(b => { counts[b.block_group] = (counts[b.block_group] ?? 0) + 1 })
    setLibraryCounts(counts)
  }

  async function addLibraryBlock() {
    const { data: { user } } = await supabase.auth.getUser()
    const maxSort = libraryBlocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0)
    const defaultSeries = seriesFilter === 'all' ? 'original' : seriesFilter
    const { data } = await supabase.from('lesson_blocks').insert({
      user_id: user.id,
      block_group: selectedGroup,
      series_tag: defaultSeries,
      title: 'New Block',
      content: '',
      sort_order: maxSort + 1,
    }).select().single()
    setLibraryBlocks(prev => [...prev, data])
    setExpandedLibraryBlocks(prev => ({ ...prev, [data.id]: true }))
    setEditingLibraryBlock(data.id)
    fetchLibraryCounts()
  }

  async function deleteLibraryBlock(id) {
    if (!confirm('Delete this library block?')) return
    await supabase.from('lesson_blocks').delete().eq('id', id)
    setLibraryBlocks(prev => prev.filter(b => b.id !== id))
    setOpenLibraryMenuId(null)
    fetchLibraryCounts()
  }

  function updateLibraryBlock(id, field, value) {
    setLibraryBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  async function saveLibraryBlock(id) {
    const block = libraryBlocks.find(b => b.id === id)
    if (!block) return
    await supabase.from('lesson_blocks').update({
      title: block.title, content: block.content, series_tag: block.series_tag,
    }).eq('id', id)
    setEditingLibraryBlock(null)
  }

  function toggleLibraryBlock(id) {
    setExpandedLibraryBlocks(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function reorderLibraryList(list, dragId, overId) {
    const dragIdx = list.findIndex(item => item.id === dragId)
    const overIdx = list.findIndex(item => item.id === overId)
    if (dragIdx === -1 || overIdx === -1 || dragIdx === overIdx) return list
    const next = [...list]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(overIdx, 0, moved)
    return next
  }

  function moveLibraryToEnd(list, dragId) {
    const dragIdx = list.findIndex(item => item.id === dragId)
    if (dragIdx === -1 || dragIdx === list.length - 1) return list
    const next = [...list]
    const [moved] = next.splice(dragIdx, 1)
    next.push(moved)
    return next
  }

  async function persistLibraryOrder(list) {
    await Promise.all(
      list.map((item, idx) => supabase.from('lesson_blocks').update({ sort_order: idx + 1 }).eq('id', item.id))
    )
  }

  function handleLibraryDrop(overId) {
    if (!dragLibraryId || dragLibraryId === overId) {
      setDragLibraryId(null); setDragOverLibraryId(null); return
    }
    const next = reorderLibraryList(libraryBlocks, dragLibraryId, overId)
    setLibraryBlocks(next)
    setDragLibraryId(null)
    setDragOverLibraryId(null)
    persistLibraryOrder(next)
  }

  function handleLibraryDropToEnd() {
    if (!dragLibraryId) return
    const next = moveLibraryToEnd(libraryBlocks, dragLibraryId)
    setLibraryBlocks(next)
    setDragLibraryId(null)
    setDragOverLibraryId(null)
    persistLibraryOrder(next)
  }

  async function saveCourse() {
    const { name, grade_tag } = courseForm
    if (!name.trim()) return
    if (editingCourseId) {
      await supabase.from('curricula').update({
        name: name.trim(),
        grade_tag: grade_tag.trim() || null,
      }).eq('id', editingCourseId)
      setCourseModal(false)
      setCourseForm({ name: '', grade_tag: '' })
      setEditingCourseId(null)
      refreshData()
      fetchCurricula()
    } else {
      const { data } = await supabase.from('curricula').insert({
        name: name.trim(),
        grade_tag: grade_tag.trim() || null,
      }).select().single()
      setCourseModal(false)
      setCourseForm({ name: '', grade_tag: '' })
      refreshData()
      if (data) setSelectedCurriculumId(data.id)
    }
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
    setCopiedBlock(null)
  }

  // ─── Insert Blocks (from library, into current lesson) ──────────────────
  async function fetchInsertBlocks() {
    const { data } = await supabase
      .from('lesson_blocks').select('*').eq('block_group', insertGroup).order('sort_order')
    setInsertBlocks(data ?? [])
  }

  function openInsertModal() {
    setInsertGroup('activities')
    setInsertSeries('all')
    setInsertSelectedIds([])
    setInsertModal(true)
  }

  function toggleInsertSelected(id) {
    setInsertSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  async function insertSelectedBlocks() {
    if (!selectedLessonId || insertSelectedIds.length === 0) { setInsertModal(false); return }
    let maxSort = blocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0)
    // Preserve the order blocks appear in the library list
    const toInsert = insertBlocks.filter(b => insertSelectedIds.includes(b.id))
    const rows = toInsert.map(b => ({
      lesson_id: selectedLessonId,
      title: b.title,
      content: b.content,
      sort_order: ++maxSort,
    }))
    const { data } = await supabase.from('blocks').insert(rows).select()
    setBlocks(prev => [...prev, ...(data ?? [])])
    setInsertModal(false)
    setInsertSelectedIds([])
  }

  async function deleteBlock(id) {
    if (!confirm('Delete this block?')) return
    await supabase.from('blocks').delete().eq('id', id)
    setBlocks(prev => prev.filter(b => b.id !== id))
    setOpenBlockMenuId(null)
  }

  // ─── Drag-to-reorder ──────────────────────────────────────────────────────
  function reorderList(list, dragId, overId) {
    const dragIdx = list.findIndex(item => item.id === dragId)
    const overIdx = list.findIndex(item => item.id === overId)
    if (dragIdx === -1 || overIdx === -1 || dragIdx === overIdx) return list
    const next = [...list]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(overIdx, 0, moved)
    return next
  }

  async function persistOrder(table, list) {
    await Promise.all(
      list.map((item, idx) => supabase.from(table).update({ sort_order: idx + 1 }).eq('id', item.id))
    )
  }

  function handleLessonDrop(overId) {
    if (!dragLessonId || dragLessonId === overId) {
      setDragLessonId(null); setDragOverLessonId(null); return
    }
    const next = reorderList(lessons, dragLessonId, overId)
    setLessons(next)
    setDragLessonId(null)
    setDragOverLessonId(null)
    persistOrder('lessons', next)
  }

  function handleBlockDrop(overId) {
    if (!dragBlockId || dragBlockId === overId) {
      setDragBlockId(null); setDragOverBlockId(null); return
    }
    const next = reorderList(blocks, dragBlockId, overId)
    setBlocks(next)
    setDragBlockId(null)
    setDragOverBlockId(null)
    persistOrder('blocks', next)
  }

  function moveToEnd(list, dragId) {
    const dragIdx = list.findIndex(item => item.id === dragId)
    if (dragIdx === -1 || dragIdx === list.length - 1) return list
    const next = [...list]
    const [moved] = next.splice(dragIdx, 1)
    next.push(moved)
    return next
  }

  function handleLessonDropToEnd() {
    if (!dragLessonId) return
    const next = moveToEnd(lessons, dragLessonId)
    setLessons(next)
    setDragLessonId(null)
    setDragOverLessonId(null)
    persistOrder('lessons', next)
  }

  function handleBlockDropToEnd() {
    if (!dragBlockId) return
    const next = moveToEnd(blocks, dragBlockId)
    setBlocks(next)
    setDragBlockId(null)
    setDragOverBlockId(null)
    persistOrder('blocks', next)
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
        {pageMode === 'plans'
          ? <HintBanner id="curriculum" message="Build your lesson plans here. Create courses, add lessons, and break each lesson into activity blocks. These plans appear on your Home dashboard when you tap a period." />
          : <HintBanner id="curriculum_library" message="Build a library of reusable block templates — generic activities, songs, warm-ups, and routines you can insert into any lesson." />
        }
        <div className="sch-sidebar-tabs">
          <button className={`sch-sidebar-tab ${pageMode === 'plans' ? 'active' : ''}`} onClick={() => setPageMode('plans')}>Lesson Plans</button>
          <button className={`sch-sidebar-tab ${pageMode === 'library' ? 'active' : ''}`} onClick={() => setPageMode('library')}>Lesson Blocks</button>
        </div>
        {pageMode === 'plans' && (
          <button className="curr-new-btn" onClick={() => { setCourseForm({ name: '', grade_tag: '' }); setEditingCourseId(null); setCourseModal(true) }}><Plus size={14} /> New Course</button>
        )}
      </div>
      {pageMode === 'plans' ? (
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
      ) : (
        <div className="curr-list">
          {BLOCK_GROUPS.map(g => (
            <div
              key={g.value}
              className={`curr-row ${selectedGroup === g.value ? 'selected' : ''}`}
              onClick={() => setSelectedGroup(g.value)}
            >
              <span className={`curr-dot ${selectedGroup === g.value ? 'active' : ''}`} />
              <div className="curr-row-body">
                <div className="curr-row-top">
                  <span className="curr-row-name">{g.label}</span>
                  <span className="curr-row-count">{libraryCounts[g.value] ?? 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Layout sidebar={sidebar}>
      <div className="curr-main">

        {pageMode === 'plans' && (
        <>
        {/* ── LESSONS VIEW ── */}
        {view === 'lessons' && (
          <>
            <div className="curr-main-header curr-main-header-lessons">
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
                    <button className="curr-block-menu-item" onClick={() => {
                      setCourseForm({ name: selectedCurriculum?.name ?? '', grade_tag: selectedCurriculum?.grade_tag ?? '' })
                      setEditingCourseId(selectedCurriculumId)
                      setOpenCourseMenu(false)
                      setCourseModal(true)
                    }}>
                      <Pencil size={14} /> Edit course
                    </button>
                    <button className="curr-block-menu-item danger" onClick={() => deleteCurriculum(selectedCurriculumId)}>
                      <Trash2 size={14} /> Delete course
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              className="curr-lesson-list"
              onDragOver={e => { if (dragLessonId) e.preventDefault() }}
              onDrop={e => { e.preventDefault(); handleLessonDropToEnd() }}
            >
              {lessons.length === 0 && <div className="curr-empty">No lessons yet. Add one above.</div>}
              {lessons.map(l => (
                <div
                  key={l.id}
                  className={`curr-lesson-row ${dragOverLessonId === l.id ? 'drag-over' : ''} ${dragLessonId === l.id ? 'dragging' : ''}`}
                  onDragOver={e => { e.preventDefault(); if (dragLessonId && dragLessonId !== l.id) setDragOverLessonId(l.id) }}
                  onDragLeave={() => setDragOverLessonId(prev => prev === l.id ? null : prev)}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); handleLessonDrop(l.id) }}
                >
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
                      <span
                        className="curr-grip-handle"
                        draggable
                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id); setDragLessonId(l.id) }}
                        onDragEnd={() => { setDragLessonId(null); setDragOverLessonId(null) }}
                      >
                        <GripVertical size={14} className="curr-grip" />
                      </span>
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
            <div className="curr-main-header curr-main-header-blocks">
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
                  <button className="curr-action-btn" onClick={openInsertModal}>
                    <Plus size={14} /> Insert Blocks
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

            <div
              className="curr-block-list"
              onDragOver={e => { if (dragBlockId) e.preventDefault() }}
              onDrop={e => { e.preventDefault(); handleBlockDropToEnd() }}
            >
              {blocks.length === 0 && <div className="curr-empty">No blocks yet. Add one above.</div>}
              {blocks.map(block => {
                const isOpen = expandedBlocks[block.id]
                const isEditing = editingBlock === block.id
                return (
                  <div
                    key={block.id}
                    className={`curr-block-row ${isOpen ? 'open' : ''} ${dragOverBlockId === block.id ? 'drag-over' : ''} ${dragBlockId === block.id ? 'dragging' : ''}`}
                    onDragOver={e => { e.preventDefault(); if (dragBlockId && dragBlockId !== block.id) setDragOverBlockId(block.id) }}
                    onDragLeave={() => setDragOverBlockId(prev => prev === block.id ? null : prev)}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); handleBlockDrop(block.id) }}
                  >
                    <div className="curr-block-header" onClick={() => toggleBlock(block.id)}>
                      <span
                        className="curr-grip-handle"
                        draggable
                        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', block.id); setDragBlockId(block.id) }}
                        onDragEnd={() => { setDragBlockId(null); setDragOverBlockId(null) }}
                        onClick={e => e.stopPropagation()}
                      >
                        <GripVertical size={14} className="curr-grip" />
                      </span>
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
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
                          className="curr-block-input"
                          value={block.content ?? ''}
                          placeholder="Add notes, steps, or instructions…"
                          onChange={e => {
                            updateBlock(block.id, 'content', e.target.value)
                            e.target.style.height = 'auto'
                            e.target.style.height = `${e.target.scrollHeight}px`
                          }}
                          onBlur={() => saveBlock(block.id)}
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
        </>
        )}

        {/* ── LESSON BLOCKS LIBRARY ── */}
        {pageMode === 'library' && (
          <>
            <div className="curr-main-header curr-main-header-lessons">
              <span className="curr-main-title">{BLOCK_GROUPS.find(g => g.value === selectedGroup)?.label}</span>
              <span className="curr-main-dot" />
              <span className="curr-main-sub">{libraryBlocks.length} Blocks</span>
              <div style={{ flex: 1 }} />
              <button className="curr-action-btn" onClick={addLibraryBlock}>
                <Plus size={14} /> New Block
              </button>
            </div>

            <div className="curr-series-tabs">
              {SERIES_TAGS.map(s => (
                <button
                  key={s.value}
                  className={`sch-sidebar-tab ${seriesFilter === s.value ? 'active' : ''}`}
                  onClick={() => setSeriesFilter(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div
              className="curr-block-list"
              onDragOver={e => { if (dragLibraryId) e.preventDefault() }}
              onDrop={e => { e.preventDefault(); handleLibraryDropToEnd() }}
            >
              {libraryBlocks.filter(b => seriesFilter === 'all' || b.series_tag === seriesFilter).length === 0 && (
                <div className="curr-empty">No blocks yet. Add one above.</div>
              )}
              {libraryBlocks
                .filter(b => seriesFilter === 'all' || b.series_tag === seriesFilter)
                .map(block => {
                const isOpen = expandedLibraryBlocks[block.id]
                const isEditing = editingLibraryBlock === block.id
                return (
                  <div
                    key={block.id}
                    className={`curr-block-row ${isOpen ? 'open' : ''} ${dragOverLibraryId === block.id ? 'drag-over' : ''} ${dragLibraryId === block.id ? 'dragging' : ''}`}
                    onDragOver={e => { e.preventDefault(); if (dragLibraryId && dragLibraryId !== block.id) setDragOverLibraryId(block.id) }}
                    onDragLeave={() => setDragOverLibraryId(prev => prev === block.id ? null : prev)}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); handleLibraryDrop(block.id) }}
                  >
                    <div className="curr-block-header" onClick={() => toggleLibraryBlock(block.id)}>
                      <span
                        className="curr-grip-handle"
                        draggable
                        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', block.id); setDragLibraryId(block.id) }}
                        onDragEnd={() => { setDragLibraryId(null); setDragOverLibraryId(null) }}
                        onClick={e => e.stopPropagation()}
                      >
                        <GripVertical size={14} className="curr-grip" />
                      </span>
                      {isEditing ? (
                        <input
                          className="curr-block-title-input"
                          value={block.title}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateLibraryBlock(block.id, 'title', e.target.value)}
                          onBlur={() => saveLibraryBlock(block.id)}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="curr-block-title"
                          onDoubleClick={e => { e.stopPropagation(); setEditingLibraryBlock(block.id) }}
                        >
                          {block.title}
                        </span>
                      )}
                      <span className="curr-grade-tag">{SERIES_TAGS.find(s => s.value === block.series_tag)?.label}</span>
                      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                          className="curr-more-btn"
                          onClick={() => setOpenLibraryMenuId(openLibraryMenuId === block.id ? null : block.id)}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {openLibraryMenuId === block.id && (
                          <div className="curr-block-menu">
                            <button
                              className="curr-block-menu-item"
                              onClick={() => { setEditingLibraryBlock(block.id); setOpenLibraryMenuId(null) }}
                            >
                              Edit title
                            </button>
                            <button
                              className="curr-block-menu-item danger"
                              onClick={() => deleteLibraryBlock(block.id)}
                            >
                              <Trash2 size={14} /> Delete block
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        className="curr-block-chevron-btn"
                        onClick={e => { e.stopPropagation(); toggleLibraryBlock(block.id) }}
                      >
                        <ChevronDown size={14} className={`curr-block-chevron ${isOpen ? 'open' : ''}`} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="curr-block-body">
                        <div className="curr-series-select">
                          {SERIES_TAGS.filter(s => s.value !== 'all').map(s => (
                            <button
                              key={s.value}
                              className={`sch-modal-chip ${block.series_tag === s.value ? 'active' : ''}`}
                              onClick={() => { updateLibraryBlock(block.id, 'series_tag', s.value); saveLibraryBlock(block.id) }}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                        <textarea
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
                          className="curr-block-input"
                          value={block.content ?? ''}
                          placeholder="Add notes, steps, or instructions…"
                          onChange={e => {
                            updateLibraryBlock(block.id, 'content', e.target.value)
                            e.target.style.height = 'auto'
                            e.target.style.height = `${e.target.scrollHeight}px`
                          }}
                          onBlur={() => saveLibraryBlock(block.id)}
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
        <div className="sc-modal-overlay" onClick={() => { setCourseModal(false); setEditingCourseId(null) }}>
          <div className="sc-modal" onClick={e => e.stopPropagation()}>
            <div className="sc-modal-header">
              <span className="sc-modal-title">{editingCourseId ? 'Edit Course' : 'New Course'}</span>
              <button className="sc-modal-close" onClick={() => { setCourseModal(false); setEditingCourseId(null) }}><X size={14} /></button>
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
              <button className="sc-form-cancel" onClick={() => { setCourseModal(false); setEditingCourseId(null) }}>Cancel</button>
              <button className="sc-form-save" onClick={saveCourse}>Save</button>
            </div>
          </div>
        </div>
      )}

      {insertModal && (
        <div className="sc-modal-overlay" onClick={() => setInsertModal(false)}>
          <div className="sc-modal sc-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="sc-modal-header">
              <span className="sc-modal-title">Insert Blocks</span>
              <button className="sc-modal-close" onClick={() => setInsertModal(false)}><X size={14} /></button>
            </div>

            <div className="curr-insert-body">
              <div className="curr-insert-groups">
                {BLOCK_GROUPS.map(g => (
                  <div
                    key={g.value}
                    className={`curr-insert-group-row ${insertGroup === g.value ? 'selected' : ''}`}
                    onClick={() => setInsertGroup(g.value)}
                  >
                    {g.label}
                  </div>
                ))}
              </div>

              <div className="curr-insert-content">
                <div className="curr-insert-tabs">
                  {SERIES_TAGS.map(s => (
                    <button
                      key={s.value}
                      className={`sch-modal-chip ${insertSeries === s.value ? 'active' : ''}`}
                      onClick={() => setInsertSeries(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="curr-insert-list">
                  {insertBlocks.filter(b => insertSeries === 'all' || b.series_tag === insertSeries).length === 0 && (
                    <div className="curr-empty">No blocks in this group yet.</div>
                  )}
                  {insertBlocks
                    .filter(b => insertSeries === 'all' || b.series_tag === insertSeries)
                    .map(b => {
                      const checked = insertSelectedIds.includes(b.id)
                      return (
                        <div
                          key={b.id}
                          className={`curr-insert-row ${checked ? 'checked' : ''}`}
                          onClick={() => toggleInsertSelected(b.id)}
                        >
                          <div className={`curr-insert-checkbox ${checked ? 'checked' : ''}`} />
                          <span className="curr-insert-title">{b.title}</span>
                          <span className="curr-grade-tag">{SERIES_TAGS.find(s => s.value === b.series_tag)?.label}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>

            <div className="sc-modal-footer">
              <button className="sc-form-cancel" onClick={() => setInsertModal(false)}>Cancel</button>
              <button className="sc-form-save" onClick={insertSelectedBlocks} disabled={insertSelectedIds.length === 0}>
                Insert {insertSelectedIds.length > 0 ? `(${insertSelectedIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}