import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import ResponsiveModal from '../components/ResponsiveModal'
import { Plus, Trash2, X, GripVertical, ArrowLeft, MoreHorizontal, Pencil, Library, BookOpen, Layers } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useIsMobile } from '../hooks/useMediaQuery'
import EmptyState from '../components/EmptyState'
import './Curriculum.css'

// Seeded default Series group for brand-new users (sidebar) — "New Group" lets
// them add their textbook series names (Let's Try, New Horizon, etc.)
const DEFAULT_BLOCK_GROUPS = ['Original']

// Fixed activity-type tabs (top of right panel) — same for every user
const ACTIVITY_TYPES = [
  { value: 'activities', label: 'Activities' },
  { value: 'music', label: 'Music' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'games', label: 'Games' },
  { value: 'routines', label: 'Routines' },
  { value: 'other', label: 'Other' },
]

export default function Curriculum() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [screen, setScreen] = useState('list') // mobile only: 'list' | 'detail' | 'blocks'

  const { curricula, refresh: refreshData } = useData()
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(null)
  const [lessons, setLessons] = useState([])
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [expandedBlocks, setExpandedBlocks] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingBlock, setEditingBlock] = useState(null)
  const [editingLessonId, setEditingLessonId] = useState(null)
  const [lessonForm, setLessonForm] = useState({ tag1: '', tag2: '' })
  const [view, setView] = useState('lessons')
  const [lessonCounts, setLessonCounts] = useState({})
  const [openBlockMenuId, setOpenBlockMenuId] = useState(null)
  const [openLessonMenuId, setOpenLessonMenuId] = useState(null)
  const [openCourseMenu, setOpenCourseMenu] = useState(false)
  const [courseModal, setCourseModal] = useState(false)
  const [courseForm, setCourseForm] = useState({ name: '', grade_tag: '' })
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [dragLessonId, setDragLessonId] = useState(null)
  const [dragOverLessonId, setDragOverLessonId] = useState(null)
  const [dragBlockId, setDragBlockId] = useState(null)
  const [dragOverBlockId, setDragOverBlockId] = useState(null)
  const [dragCourseId, setDragCourseId] = useState(null)
  const [dragOverCourseId, setDragOverCourseId] = useState(null)
  const [courseOrderOverride, setCourseOrderOverride] = useState(null)

  // ─── Lesson Blocks library ──────────────────────────────────────────────
  const [pageMode, setPageMode] = useState('plans') // 'plans' | 'library'
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [blockGroups, setBlockGroups] = useState([])
  const [activityFilter, setActivityFilter] = useState('activities')
  const [libraryBlocks, setLibraryBlocks] = useState([])
  const [libraryCounts, setLibraryCounts] = useState({})
  const [expandedLibraryBlocks, setExpandedLibraryBlocks] = useState({})
  const [editingLibraryBlock, setEditingLibraryBlock] = useState(null)
  const [openLibraryMenuId, setOpenLibraryMenuId] = useState(null)
  const [dragLibraryId, setDragLibraryId] = useState(null)
  const [dragOverLibraryId, setDragOverLibraryId] = useState(null)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [groupForm, setGroupForm] = useState('')
  const [openGroupMenuId, setOpenGroupMenuId] = useState(null)
  const [newGroupModal, setNewGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [dragGroupId, setDragGroupId] = useState(null)
  const [dragOverGroupId, setDragOverGroupId] = useState(null)

  // ─── Insert Blocks modal (within lesson editor) ─────────────────────────
  const [insertModal, setInsertModal] = useState(false)
  const [insertGroupId, setInsertGroupId] = useState(null)
  const [insertActivity, setInsertActivity] = useState('activities')
  const [insertBlocks, setInsertBlocks] = useState([]) // library blocks for insertGroupId
  const [insertSelectedIds, setInsertSelectedIds] = useState([])

  useEffect(() => { fetchCurricula() }, [])
  useEffect(() => { if (selectedCurriculumId) fetchLessons() }, [selectedCurriculumId])
  useEffect(() => { if (selectedLessonId && view === 'blocks') fetchBlocks() }, [selectedLessonId, view])
  useEffect(() => { if (pageMode === 'library') fetchBlockGroups() }, [pageMode])
  useEffect(() => { if (pageMode === 'library' && selectedGroupId) fetchLibraryBlocks() }, [pageMode, selectedGroupId, activityFilter])
  useEffect(() => { if (pageMode === 'library') fetchLibraryCounts() }, [pageMode, blockGroups])
  useEffect(() => { if (insertModal) fetchInsertBlocks() }, [insertModal, insertGroupId, insertActivity])

  useEffect(() => {
    function handleClick() { setOpenLibraryMenuId(null) }
    if (openLibraryMenuId) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
    }
    return () => document.removeEventListener('click', handleClick)
  }, [openLibraryMenuId])

  useEffect(() => {
    function handleClick() { setOpenGroupMenuId(null) }
    if (openGroupMenuId) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
    }
    return () => document.removeEventListener('click', handleClick)
  }, [openGroupMenuId])

  useEffect(() => {
    function handleClick() { setOpenBlockMenuId(null) }
    if (openBlockMenuId) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
    }
    return () => document.removeEventListener('click', handleClick)
  }, [openBlockMenuId])

  useEffect(() => {
    function handleClick() { setOpenLessonMenuId(null) }
    if (openLessonMenuId) {
      setTimeout(() => document.addEventListener('click', handleClick), 0)
    }
    return () => document.removeEventListener('click', handleClick)
  }, [openLessonMenuId])

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
      if (isMobile) setScreen('blocks')
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
  // ─── Block Groups ─────────────────────────────────────────────────────
  async function fetchBlockGroups() {
    const { data } = await supabase.from('block_groups').select('*').order('sort_order')
    if ((data ?? []).length === 0) {
      // Seed defaults for brand-new users
      const { data: { user } } = await supabase.auth.getUser()
      const rows = DEFAULT_BLOCK_GROUPS.map((label, i) => ({ user_id: user.id, label, sort_order: i + 1 }))
      const { data: seeded } = await supabase.from('block_groups').insert(rows).select().order('sort_order')
      setBlockGroups(seeded ?? [])
      if (seeded?.length > 0 && !selectedGroupId) setSelectedGroupId(seeded[0].id)
      if (seeded?.length > 0 && !insertGroupId) setInsertGroupId(seeded[0].id)
    } else {
      setBlockGroups(data)
      if (!selectedGroupId) setSelectedGroupId(data[0].id)
      if (!insertGroupId) setInsertGroupId(data[0].id)
    }
  }

  async function addBlockGroup() {
    if (!newGroupName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const maxSort = blockGroups.reduce((m, g) => Math.max(m, g.sort_order ?? 0), 0)
    const { data } = await supabase.from('block_groups').insert({
      user_id: user.id, label: newGroupName.trim(), sort_order: maxSort + 1,
    }).select().single()
    setBlockGroups(prev => [...prev, data])
    setSelectedGroupId(data.id)
    setNewGroupModal(false)
    setNewGroupName('')
  }

  async function saveGroupName(id) {
    const group = blockGroups.find(g => g.id === id)
    if (!group) return
    await supabase.from('block_groups').update({ label: group.label }).eq('id', id)
    setEditingGroupId(null)
  }

  function updateGroupName(id, value) {
    setBlockGroups(prev => prev.map(g => g.id === id ? { ...g, label: value } : g))
  }

  async function deleteBlockGroup(id) {
    if (!confirm('Delete this series and all its blocks?')) return
    await supabase.from('block_groups').delete().eq('id', id)
    const remaining = blockGroups.filter(g => g.id !== id)
    setBlockGroups(remaining)
    setOpenGroupMenuId(null)
    if (selectedGroupId === id) setSelectedGroupId(remaining[0]?.id ?? null)
    if (isMobile) setScreen('list')
  }

  // ─── Library blocks ───────────────────────────────────────────────────
  async function fetchLibraryBlocks() {
    const { data } = await supabase
      .from('lesson_blocks').select('*')
      .eq('block_group_id', selectedGroupId)
      .eq('activity_type', activityFilter)
      .order('sort_order')
    setLibraryBlocks(data ?? [])
    setExpandedLibraryBlocks({})
  }

  async function fetchLibraryCounts() {
    const { data } = await supabase.from('lesson_blocks').select('block_group_id')
    const counts = {}
    data?.forEach(b => { counts[b.block_group_id] = (counts[b.block_group_id] ?? 0) + 1 })
    setLibraryCounts(counts)
  }

  async function addLibraryBlock() {
    const { data: { user } } = await supabase.auth.getUser()
    const maxSort = libraryBlocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0)
    const { data } = await supabase.from('lesson_blocks').insert({
      user_id: user.id,
      block_group_id: selectedGroupId,
      activity_type: activityFilter,
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

  async function saveLibraryBlock(id, override) {
    const block = override ?? libraryBlocks.find(b => b.id === id)
    if (!block) return
    await supabase.from('lesson_blocks').update({
      title: block.title, content: block.content,
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
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('curricula').insert({
        user_id: user.id,
        name: name.trim(),
        grade_tag: grade_tag.trim() || null,
      }).select().single()
      if (error) { console.error(error); alert('Could not create course: ' + error.message); return }
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
    setOpenLessonMenuId(null)
    setView('lessons')
    if (isMobile) setScreen('detail')
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
    if (isMobile) setScreen('list')
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

  // ─── Insert Blocks (from library, into current lesson) ──────────────────
  async function fetchInsertBlocks() {
    if (!insertGroupId) { setInsertBlocks([]); return }
    const { data } = await supabase
      .from('lesson_blocks').select('*')
      .eq('block_group_id', insertGroupId)
      .eq('activity_type', insertActivity)
      .order('sort_order')
    setInsertBlocks(data ?? [])
  }

  function openInsertModal() {
    setInsertGroupId(blockGroups[0]?.id ?? null)
    setInsertActivity('activities')
    setInsertSelectedIds([])
    setInsertModal(true)
    if (blockGroups.length === 0) fetchBlockGroups()
    else if (!insertGroupId) setInsertGroupId(blockGroups[0]?.id ?? null)
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

  function handleCourseDrop(overId) {
    if (!dragCourseId || dragCourseId === overId) {
      setDragCourseId(null); setDragOverCourseId(null); return
    }
    const next = reorderList(courseOrderOverride ?? curricula, dragCourseId, overId)
    setCourseOrderOverride(next)
    setDragCourseId(null)
    setDragOverCourseId(null)
    persistOrder('curricula', next).then(() => { refreshData(); setCourseOrderOverride(null) })
  }

  function handleCourseDropToEnd() {
    if (!dragCourseId) return
    const next = moveToEnd(courseOrderOverride ?? curricula, dragCourseId)
    setCourseOrderOverride(next)
    setDragCourseId(null)
    setDragOverCourseId(null)
    persistOrder('curricula', next).then(() => { refreshData(); setCourseOrderOverride(null) })
  }

  function handleBlockDropToEnd() {
    if (!dragBlockId) return
    const next = moveToEnd(blocks, dragBlockId)
    setBlocks(next)
    setDragBlockId(null)
    setDragOverBlockId(null)
    persistOrder('blocks', next)
  }

  function handleGroupDrop(overId) {
    if (!dragGroupId || dragGroupId === overId) {
      setDragGroupId(null); setDragOverGroupId(null); return
    }
    const next = reorderList(blockGroups, dragGroupId, overId)
    setBlockGroups(next)
    setDragGroupId(null)
    setDragOverGroupId(null)
    persistOrder('block_groups', next)
  }

  function handleGroupDropToEnd() {
    if (!dragGroupId) return
    const next = moveToEnd(blockGroups, dragGroupId)
    setBlockGroups(next)
    setDragGroupId(null)
    setDragOverGroupId(null)
    persistOrder('block_groups', next)
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
    if (isMobile) setScreen('blocks')
  }

  const selectedLesson = lessons.find(l => l.id === selectedLessonId)
  const selectedCurriculum = curricula.find(c => c.id === selectedCurriculumId)


  if (loading) {
    return isMobile
      ? <div className="curr-mobile" />
      : <Layout sidebar={<div />}><div /></Layout>
  }

  const sidebar = (
    <div className="curr-sidebar">
      <div className="curr-count-box">
        <h1 className="curr-title">Courses</h1>
        {pageMode === 'plans'
          ? <HintBanner id="curriculum" message="Build your lesson plans here. Create courses, add lessons, and break each lesson into activity blocks. These plans appear on your Home dashboard when you tap a period." />
          : <HintBanner id="curriculum_library" message="Organize reusable blocks by series — Original, Let's Try, New Horizon, or whatever textbooks you use. Within each, sort blocks by type using the tabs above." />
        }
        <div className="sch-sidebar-tabs">
          <button className={`sch-sidebar-tab ${pageMode === 'plans' ? 'active' : ''}`} onClick={() => setPageMode('plans')}>Lesson Plans</button>
          <button className={`sch-sidebar-tab ${pageMode === 'library' ? 'active' : ''}`} onClick={() => setPageMode('library')}>Lesson Blocks</button>
        </div>
        {pageMode === 'plans' && (
          <button className="curr-new-btn" onClick={() => { setCourseForm({ name: '', grade_tag: '' }); setEditingCourseId(null); setCourseModal(true) }}><Plus size={14} /> New Course</button>
        )}
        {pageMode === 'library' && (
          <button className="curr-new-btn" onClick={() => { setNewGroupName(''); setNewGroupModal(true) }}><Plus size={14} /> New Series</button>
        )}
      </div>
      {pageMode === 'plans' ? (
        <div
          className="curr-list"
          onDragOver={e => { if (dragCourseId) e.preventDefault() }}
          onDrop={e => { e.preventDefault(); handleCourseDropToEnd() }}
        >
          {(courseOrderOverride ?? curricula).map(c => (
            <div
              key={c.id}
              className={`curr-row ${selectedCurriculumId === c.id ? 'selected' : ''} ${dragOverCourseId === c.id ? 'drag-over' : ''} ${dragCourseId === c.id ? 'dragging' : ''}`}
              onClick={() => { setSelectedCurriculumId(c.id); setView('lessons'); if (isMobile) setScreen('detail') }}
              onDragOver={e => { e.preventDefault(); if (dragCourseId && dragCourseId !== c.id) setDragOverCourseId(c.id) }}
              onDragLeave={() => setDragOverCourseId(prev => prev === c.id ? null : prev)}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); handleCourseDrop(c.id) }}
            >
              <span className={`curr-dot ${selectedCurriculumId === c.id ? 'active' : ''}`} />
              <div className="curr-row-body">
                <div className="curr-row-top">
                  <span
                    className="curr-grip-handle"
                    draggable
                    onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); setDragCourseId(c.id) }}
                    onDragEnd={() => { setDragCourseId(null); setDragOverCourseId(null) }}
                    onClick={e => e.stopPropagation()}
                  >
                    <GripVertical size={14} className="curr-grip" />
                  </span>
                  <span className="curr-row-name">{c.name}</span>
                  <span className="curr-row-count">{lessonCounts[c.id] ?? 0}</span>
                </div>
                {c.grade_tag && <span className="curr-grade-tag grip-offset">{c.grade_tag}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="curr-list"
          onDragOver={e => { if (dragGroupId) e.preventDefault() }}
          onDrop={e => { e.preventDefault(); handleGroupDropToEnd() }}
        >
          {blockGroups.map(g => (
            <div
              key={g.id}
              className={`curr-row ${selectedGroupId === g.id ? 'selected' : ''} ${dragOverGroupId === g.id ? 'drag-over' : ''} ${dragGroupId === g.id ? 'dragging' : ''}`}
              onClick={() => { if (editingGroupId !== g.id) { setSelectedGroupId(g.id); if (isMobile) setScreen('detail') } }}
              onDragOver={e => { e.preventDefault(); if (dragGroupId && dragGroupId !== g.id) setDragOverGroupId(g.id) }}
              onDragLeave={() => setDragOverGroupId(prev => prev === g.id ? null : prev)}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); handleGroupDrop(g.id) }}
            >
              <span
                className="curr-grip-handle"
                draggable
                onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g.id); setDragGroupId(g.id) }}
                onDragEnd={() => { setDragGroupId(null); setDragOverGroupId(null) }}
                onClick={e => e.stopPropagation()}
              >
                <GripVertical size={14} className="curr-grip" />
              </span>
              <div className="curr-row-body">
                <div className="curr-row-top">
                  {editingGroupId === g.id ? (
                    <input
                      className="curr-lesson-edit-input"
                      value={g.label}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateGroupName(g.id, e.target.value)}
                      onBlur={() => saveGroupName(g.id)}
                      onKeyDown={e => { if (e.key === 'Enter') saveGroupName(g.id) }}
                      autoFocus
                    />
                  ) : (
                    <span className="curr-row-name">{g.label}</span>
                  )}
                  <span className="curr-row-count">{libraryCounts[g.id] ?? 0}</span>
                </div>
              </div>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button
                  className="curr-more-btn"
                  onClick={() => setOpenGroupMenuId(openGroupMenuId === g.id ? null : g.id)}
                >
                  <MoreHorizontal size={14} />
                </button>
                {openGroupMenuId === g.id && (
                  <div className="curr-block-menu">
                    <button
                      className="curr-block-menu-item"
                      onClick={() => { setEditingGroupId(g.id); setOpenGroupMenuId(null) }}
                    >
                      <Pencil size={14} /> Rename series
                    </button>
                    <button
                      className="curr-block-menu-item danger"
                      onClick={() => deleteBlockGroup(g.id)}
                    >
                      <Trash2 size={14} /> Delete series
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const desktopContent = (
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
              {lessons.length === 0 && <EmptyState icon={BookOpen} message="No lessons yet" sub="Add one above" compact />}
              {lessons.map(l => (
                <div
                  key={l.id}
                  className={`curr-lesson-row ${dragOverLessonId === l.id ? 'drag-over' : ''} ${dragLessonId === l.id ? 'dragging' : ''}`}
                  onClick={() => { if (editingLessonId !== l.id) drillIntoLesson(l.id) }}
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
                        onClick={e => e.stopPropagation()}
                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id); setDragLessonId(l.id) }}
                        onDragEnd={() => { setDragLessonId(null); setDragOverLessonId(null) }}
                      >
                        <GripVertical size={14} className="curr-grip" />
                      </span>
                      <span className="curr-lesson-unit">
                        {l.tag1 ?? '—'}
                      </span>
                      <span className="curr-lesson-sep" />
                      <span className="curr-lesson-name">
                        {l.tag2 ?? 'Untitled'}
                      </span>
                      <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="curr-more-btn" onClick={() => setOpenLessonMenuId(openLessonMenuId === l.id ? null : l.id)}>
                          <MoreHorizontal size={14} />
                        </button>
                        {openLessonMenuId === l.id && (
                          <div className="curr-block-menu">
                            <button
                              className="curr-block-menu-item"
                              onClick={() => {
                                setEditingLessonId(l.id)
                                setLessonForm({ tag1: l.tag1 ?? '', tag2: l.tag2 ?? '' })
                                setOpenLessonMenuId(null)
                              }}
                            >
                              <Pencil size={14} /> Edit lesson title
                            </button>
                            <button
                              className="curr-block-menu-item danger"
                              onClick={() => deleteLesson(l.id)}
                            >
                              <Trash2 size={14} /> Delete lesson
                            </button>
                          </div>
                        )}
                      </div>
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
              <button className="curr-back-btn" onClick={() => setView('lessons')}>
                <ArrowLeft size={14} />
              </button>
              <span className="curr-main-title">{selectedLesson?.tag1 ?? '—'}</span>
              <span className="curr-main-dot" />
              <span className="curr-main-sub">{selectedLesson?.tag2 ?? 'Untitled'}</span>
              <div style={{ flex: 1 }} />
              <button className="curr-action-btn" onClick={addBlock}>
                <Plus size={14} /> New Block
              </button>
              <button className="curr-action-btn" onClick={openInsertModal}>
                <Plus size={14} /> Insert Blocks
              </button>
            </div>

            <div
              className="curr-block-list"
              onDragOver={e => { if (dragBlockId) e.preventDefault() }}
              onDrop={e => { e.preventDefault(); handleBlockDropToEnd() }}
            >
              {blocks.length === 0 && <EmptyState icon={Layers} message="No blocks yet" sub="Add one above" compact />}
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
                    <div className="curr-block-header" onClick={() => { if (!isEditing) toggleBlock(block.id) }}>
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
                      <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
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
              <span className="curr-main-title">{blockGroups.find(g => g.id === selectedGroupId)?.label}</span>
              <span className="curr-main-dot" />
              <span className="curr-main-sub">{libraryBlocks.length} Blocks</span>
              <div style={{ flex: 1 }} />
              <button className="curr-action-btn" onClick={addLibraryBlock}>
                <Plus size={14} /> New Block
              </button>
            </div>

            <div className="curr-series-tabs">
              {ACTIVITY_TYPES.map(a => (
                <button
                  key={a.value}
                  className={`sch-sidebar-tab ${activityFilter === a.value ? 'active' : ''}`}
                  onClick={() => setActivityFilter(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div
              className="curr-block-list"
              onDragOver={e => { if (dragLibraryId) e.preventDefault() }}
              onDrop={e => { e.preventDefault(); handleLibraryDropToEnd() }}
            >
              {libraryBlocks.length === 0 && (
                <EmptyState icon={Layers} message="No blocks yet" sub="Add one above" compact />
              )}
              {libraryBlocks
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
                    <div className="curr-block-header" onClick={() => { if (!isEditing) toggleLibraryBlock(block.id) }}>
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
                      <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
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
                    </div>
                    {isOpen && (
                      <div className="curr-block-body">
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
    </Layout>
  )

  const mobileContent = (
    <div className="curr-mobile">
      {screen === 'list' && (
        <div className="hm-screen">
          {sidebar}
        </div>
      )}

      {screen === 'detail' && pageMode === 'plans' && (
        <div className="hm-screen">
          <div className="hm-detail-topbar">
            <button className="hm-back-btn" onClick={() => setScreen('list')}>
              <ArrowLeft size={16} />
            </button>
            <span className="hm-detail-subtitle">{selectedCurriculum?.name}</span>
            <button className="hm-edit-btn" onClick={addLesson}>
              <Plus size={16} />
            </button>
            <button
              className="hm-edit-btn"
              onClick={() => {
                setCourseForm({ name: selectedCurriculum?.name ?? '', grade_tag: selectedCurriculum?.grade_tag ?? '' })
                setEditingCourseId(selectedCurriculumId)
                setCourseModal(true)
              }}
            >
              <Pencil size={16} />
            </button>
          </div>
          <div className="curr-lesson-list hm-block-list">
            {lessons.length === 0 && <EmptyState icon={BookOpen} message="No lessons yet" sub="Add one above" compact />}
            {lessons.map(l => (
              <div key={l.id} className="curr-lesson-row" onClick={() => drillIntoLesson(l.id)}>
                <span className="curr-lesson-unit">{l.tag1 ?? '—'}</span>
                <span className="curr-lesson-sep" />
                <span className="curr-lesson-name">{l.tag2 ?? 'Untitled'}</span>
                <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button className="curr-more-btn" onClick={() => setOpenLessonMenuId(openLessonMenuId === l.id ? null : l.id)}>
                    <MoreHorizontal size={14} />
                  </button>
                  {openLessonMenuId === l.id && (
                    <div className="curr-block-menu">
                      <button
                        className="curr-block-menu-item"
                        onClick={() => {
                          setEditingLessonId(l.id)
                          setLessonForm({ tag1: l.tag1 ?? '', tag2: l.tag2 ?? '' })
                          setOpenLessonMenuId(null)
                        }}
                      >
                        <Pencil size={14} /> Edit lesson title
                      </button>
                      <button
                        className="curr-block-menu-item danger"
                        onClick={() => deleteLesson(l.id)}
                      >
                        <Trash2 size={14} /> Delete lesson
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === 'blocks' && pageMode === 'plans' && (
        <div className="hm-screen">
          <div className="hm-detail-topbar">
            <button className="hm-back-btn" onClick={() => setScreen('detail')}>
              <ArrowLeft size={16} />
            </button>
            <span className="hm-detail-subtitle">
              {selectedLesson?.tag1 ?? '—'} · {selectedLesson?.tag2 ?? 'Untitled'}
            </span>
            <button className="hm-edit-btn" onClick={addBlock}>
              <Plus size={16} />
            </button>
            <button className="hm-edit-btn" onClick={openInsertModal}>
              <Library size={16} />
            </button>
          </div>
          <div className="curr-block-list hm-block-list">
            {blocks.length === 0 && <EmptyState icon={Layers} message="No blocks yet" sub="Add one above" compact />}
            {blocks.map(block => {
              const isOpen = expandedBlocks[block.id]
              const isEditing = editingBlock === block.id
              return (
                <div key={block.id} className={`curr-block-row ${isOpen ? 'open' : ''}`}>
                  <div className="curr-block-header" onClick={() => { if (!isEditing) toggleBlock(block.id) }}>
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
                    <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
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
                            <Pencil size={14} /> Edit title
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
        </div>
      )}

      {screen === 'detail' && pageMode === 'library' && (
        <div className="hm-screen">
          <div className="hm-detail-topbar">
            <button className="hm-back-btn" onClick={() => setScreen('list')}>
              <ArrowLeft size={16} />
            </button>
            <span className="hm-detail-subtitle">{blockGroups.find(g => g.id === selectedGroupId)?.label}</span>
            <button className="hm-edit-btn" onClick={addLibraryBlock}>
              <Plus size={16} />
            </button>
          </div>
          <div className="curr-series-tabs">
            {ACTIVITY_TYPES.map(a => (
              <button
                key={a.value}
                className={`sch-sidebar-tab ${activityFilter === a.value ? 'active' : ''}`}
                onClick={() => setActivityFilter(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="curr-block-list hm-block-list">
            {libraryBlocks.length === 0 && <EmptyState icon={Library} message="No blocks yet" sub="Add one above" compact />}
            {libraryBlocks.map(block => {
              const isOpen = expandedLibraryBlocks[block.id]
              const isEditing = editingLibraryBlock === block.id
              return (
                <div key={block.id} className={`curr-block-row ${isOpen ? 'open' : ''}`}>
                  <div className="curr-block-header" onClick={() => { if (!isEditing) toggleLibraryBlock(block.id) }}>
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
                      <span className="curr-block-title">{block.title}</span>
                    )}
                    <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
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
                            <Pencil size={14} /> Edit title
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
                  </div>
                  {isOpen && (
                    <div className="curr-block-body">
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
        </div>
      )}
    </div>
  )

  return (
    <>
      {isMobile ? mobileContent : desktopContent}

      <ResponsiveModal
        isMobile={isMobile}
        open={courseModal}
        onClose={() => { setCourseModal(false); setEditingCourseId(null) }}
        title={editingCourseId ? 'Edit Course' : 'New Course'}
        footer={
          <>
            <button className="sc-form-cancel" onClick={() => { setCourseModal(false); setEditingCourseId(null) }}>Cancel</button>
            <button className="sc-form-save" onClick={saveCourse}>Save</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      </ResponsiveModal>

      <ResponsiveModal
        isMobile={isMobile}
        open={newGroupModal}
        onClose={() => setNewGroupModal(false)}
        title="New Series"
        footer={
          <>
            <button className="sc-form-cancel" onClick={() => setNewGroupModal(false)}>Cancel</button>
            <button className="sc-form-save" onClick={addBlockGroup}>Save</button>
          </>
        }
      >
        <div className="sc-field">
          <span className="sc-field-label">SERIES NAME</span>
          <input
            className="sc-input"
            placeholder="e.g. Let's Try, New Horizon, Sunshine"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addBlockGroup() }}
            autoFocus
          />
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        isMobile={isMobile}
        open={insertModal}
        onClose={() => setInsertModal(false)}
        title="Insert Blocks"
        wide
        footer={
          <>
            <button className="sc-form-cancel" onClick={() => setInsertModal(false)}>Cancel</button>
            <button className="sc-form-save" onClick={insertSelectedBlocks} disabled={insertSelectedIds.length === 0}>
              Insert {insertSelectedIds.length > 0 ? `(${insertSelectedIds.length})` : ''}
            </button>
          </>
        }
      >
        <div className="curr-insert-body">
          <div className="curr-insert-groups">
            {blockGroups.map(g => (
              <div
                key={g.id}
                className={`curr-insert-group-row ${insertGroupId === g.id ? 'selected' : ''}`}
                onClick={() => setInsertGroupId(g.id)}
              >
                {g.label}
              </div>
            ))}
          </div>

          <div className="curr-insert-content">
            <div className="curr-insert-tabs">
              {ACTIVITY_TYPES.map(a => (
                <button
                  key={a.value}
                  className={`sch-modal-chip ${insertActivity === a.value ? 'active' : ''}`}
                  onClick={() => setInsertActivity(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="curr-insert-list">
              {insertBlocks.length === 0 && (
                <EmptyState icon={Layers} message="No blocks in this group yet" compact />
              )}
              {insertBlocks
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
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </ResponsiveModal>
    </>
  )
}