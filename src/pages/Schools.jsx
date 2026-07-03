import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import HintBanner from '../components/HintBanner'
import ResponsiveModal from '../components/ResponsiveModal'
import { Plus, ChevronLeft, ChevronRight, Trash2, ArrowLeft, Users } from 'lucide-react'
import { useIsMobile } from '../hooks/useMediaQuery'
import EmptyState from '../components/EmptyState'
import './Schools.css'

export default function Schools() {
  const isMobile = useIsMobile()
  const [screen, setScreen] = useState('list') // mobile only: 'list' | 'classes'
  const { schools, curricula, lessonsByCurriculum, progress: classProgressCtx, refresh: refreshData } = useData()
  const [selectedSchoolId, setSelectedSchoolId] = useState(null)
  const [classes, setClasses] = useState([])
  const [classCounts, setClassCounts] = useState({})
  const [editingClass, setEditingClass] = useState(null)
  const [classForm, setClassForm] = useState({ label: '', curriculum_id: '', hrt_name: '', student_count: '' })
  const [formLessonIdx, setFormLessonIdx] = useState(0)
  const [newSchoolModal, setNewSchoolModal] = useState(false)
  const [newSchoolName, setNewSchoolName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchBase() }, [])
  useEffect(() => { if (selectedSchoolId) fetchSchoolClasses() }, [selectedSchoolId])

  async function fetchBase() {
    const { data: classData } = await supabase.from('classes').select('id, school_id')
    const counts = {}
    classData?.forEach(c => { counts[c.school_id] = (counts[c.school_id] ?? 0) + 1 })
    setClassCounts(counts)
    if (schools.length > 0 && !selectedSchoolId) setSelectedSchoolId(schools[0].id)
    setLoading(false)
  }

  async function fetchSchoolClasses() {
    const { data } = await supabase
      .from('classes')
      .select('*, curriculum:curricula(name, grade_tag)')
      .eq('school_id', selectedSchoolId)
      .order('sort_order')
    setClasses(data ?? [])
  }

  async function saveNewSchool() {
    if (!newSchoolName.trim()) return
    const maxSort = schools.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { data } = await supabase.from('schools').insert({
      name: newSchoolName.trim(), sort_order: maxSort + 1
    }).select().single()
    setNewSchoolModal(false)
    setNewSchoolName('')
    fetchBase()
    refreshData()
    if (data) setSelectedSchoolId(data.id)
  }

  function openEditClass(cls) {
    setEditingClass(cls.id)
    setClassForm({
      label: cls.label,
      curriculum_id: cls.curriculum_id ?? '',
      hrt_name: cls.hrt_name ?? '',
      student_count: cls.student_count ?? '',
    })
    const lessons = lessonsByCurriculum[cls.curriculum_id] ?? []
    const currentLesson = classProgressCtx[cls.id]
    const idx = currentLesson ? lessons.findIndex(l => l.id === currentLesson.id) : 0
    setFormLessonIdx(Math.max(0, idx))
  }

  function openNewClass() {
    setEditingClass('new')
    setClassForm({ label: '', curriculum_id: '', hrt_name: '', student_count: '' })
    setFormLessonIdx(0)
  }

  function closeModal() {
    setEditingClass(null)
    setClassForm({ label: '', curriculum_id: '', hrt_name: '', student_count: '' })
  }

  async function saveClass() {
    const { label, curriculum_id, hrt_name, student_count } = classForm
    if (!label) return

    let classId = editingClass

    if (editingClass === 'new') {
      const maxSort = classes.reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0)
      const { data: newClass } = await supabase.from('classes').insert({
        school_id: selectedSchoolId, label,
        curriculum_id: curriculum_id || null,
        hrt_name: hrt_name || null,
        student_count: student_count ? parseInt(student_count) : null,
        sort_order: maxSort + 1
      }).select().single()
      classId = newClass?.id
    } else {
      await supabase.from('classes').update({
        label, curriculum_id: curriculum_id || null,
        hrt_name: hrt_name || null,
        student_count: student_count ? parseInt(student_count) : null,
      }).eq('id', editingClass)
    }

    if (classId && curriculum_id) {
      const lessons = lessonsByCurriculum[curriculum_id] ?? []
      const lesson = lessons[formLessonIdx]
      if (lesson) {
        await supabase.from('class_progress').upsert({
          class_id: classId, current_lesson_id: lesson.id,
        }, { onConflict: 'class_id' })
      }
    }

    closeModal()
    fetchSchoolClasses()
    fetchBase()
    refreshData()
  }

  async function deleteClass(id) {
    await supabase.from('classes').delete().eq('id', id)
    closeModal()
    fetchSchoolClasses()
    fetchBase()
    refreshData()
  }

  const [deleteSchoolModal, setDeleteSchoolModal] = useState(false)
  const [deletingSchool, setDeletingSchool] = useState(null)

  async function deleteSchool() {
    if (!deletingSchool) return
    // Delete in order: period_slots, periods, school_days, classes, then school
    const { data: sdRows } = await supabase.from('school_days').select('id, periods(id)').eq('school_id', deletingSchool.id)
    for (const sd of sdRows ?? []) {
      for (const p of sd.periods ?? []) {
        await supabase.from('period_slots').delete().eq('period_id', p.id)
        await supabase.from('period_overrides').delete().eq('period_id', p.id)
      }
      await supabase.from('periods').delete().eq('school_day_id', sd.id)
    }
    await supabase.from('school_days').delete().eq('school_id', deletingSchool.id)
    await supabase.from('classes').delete().eq('school_id', deletingSchool.id)
    await supabase.from('schools').delete().eq('id', deletingSchool.id)
    setDeleteSchoolModal(false)
    setDeletingSchool(null)
    if (selectedSchoolId === deletingSchool.id) setSelectedSchoolId(schools.filter(s => s.id !== deletingSchool.id)[0]?.id ?? null)
    fetchBase()
    refreshData()
  }

  function getCurriculumName(curriculumId) {
    return curricula.find(c => c.id === curriculumId)?.name ?? ''
  }

  const selectedSchool = schools.find(s => s.id === selectedSchoolId)

  if (loading) {
    return isMobile
      ? <div className="sc-mobile" />
      : <Layout sidebar={<div />}><div /></Layout>
  }

  const sidebarContent = (
    <>
      <div className="sc-sidebar-header">
        <h1 className="sc-sidebar-title">Schools</h1>
        <HintBanner id="schools" message="Manage your schools and classes here. Classes you add to a school will appear as options when setting up your schedule." />
        <button className="sc-new-btn" onClick={() => { setNewSchoolName(''); setNewSchoolModal(true) }}>
          <Plus size={14} /> New School
        </button>
      </div>
      <div className="sc-list">
        {schools.map(s => (
          <div
            key={s.id}
            className={`sc-row ${selectedSchoolId === s.id ? 'selected' : ''}`}
            onClick={() => { setSelectedSchoolId(s.id); if (isMobile) setScreen('classes') }}
          >
            <div className="sc-row-top">
              <span className="sc-row-name">{s.name}</span>
              <span className="sc-row-count">{classCounts[s.id] ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )

  const classList = (
    <div className="sc-class-list">
      {classes.length === 0 && (
        <EmptyState icon={Users} message="No classes yet" sub="Add one above" compact />
      )}
      {classes.map(cls => {
        const currentLesson = classProgressCtx[cls.id]?.current_lesson
        const currName = getCurriculumName(cls.curriculum_id)
        return (
          <div key={cls.id} className="sc-class-row" onClick={() => openEditClass(cls)}>
            <div className="sc-class-body">
              <div className="sc-class-title-row">
                <span className="sc-class-label">{cls.label}</span>
                {cls.curriculum && <span className="sc-class-dot" />}
                {cls.curriculum && <span className="sc-class-curr">{currName}</span>}
                {currentLesson?.tag1 && <span className="sc-class-dot" />}
                {currentLesson?.tag1 && <span className="sc-class-lesson">{currentLesson.tag1}</span>}
                {currentLesson?.tag1 && currentLesson?.tag2 && <span className="sc-class-dot" />}
                {currentLesson?.tag2 && <span className="sc-class-lesson">{currentLesson.tag2}</span>}
              </div>
              <div className="sc-class-chips">
                {cls.curriculum && <span className="sc-chip sc-chip-grade">{cls.curriculum.grade_tag ?? cls.curriculum.name}</span>}
                {cls.hrt_name && <span className="sc-chip sc-chip-teacher">{cls.hrt_name}</span>}
                {cls.student_count && <span className="sc-chip sc-chip-students">{cls.student_count} students</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const isNewClass = editingClass === 'new'
  const formLessons = lessonsByCurriculum[classForm.curriculum_id] ?? []
  const formCurrentLesson = formLessons[formLessonIdx]

  const modals = (
    <>
      {/* Class modal — new or edit */}
      <ResponsiveModal
        isMobile={isMobile}
        open={!!editingClass}
        onClose={closeModal}
        title={isNewClass ? 'New Class' : 'Edit Class'}
        footer={
          <>
            {!isNewClass && (
              <button className="sc-form-delete" onClick={() => deleteClass(editingClass)}>Delete</button>
            )}
            <button className="sc-form-cancel" onClick={closeModal}>Cancel</button>
            <button className="sc-form-save" onClick={saveClass}>Save</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="sc-field">
            <span className="sc-field-label">CLASS LABEL</span>
            <input
              className="sc-input"
              placeholder="e.g. 3-1"
              value={classForm.label}
              onChange={e => setClassForm(p => ({ ...p, label: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="sc-field">
            <span className="sc-field-label">COURSE</span>
            <select
              className="sc-select"
              value={classForm.curriculum_id}
              onChange={e => { setClassForm(p => ({ ...p, curriculum_id: e.target.value })); setFormLessonIdx(0) }}
            >
              <option value="">No course</option>
              {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {classForm.curriculum_id && (
            <div className="sc-field">
              <span className="sc-field-label">CURRENT LESSON</span>
              <div className="sc-lesson-picker-row">
                <button className="sc-lesson-arrow" onClick={() => setFormLessonIdx(i => Math.max(0, i - 1))} disabled={formLessonIdx === 0}><ChevronLeft size={14} /></button>
                <span className="sc-lesson-picker-val">{formCurrentLesson ? [formCurrentLesson.tag1, formCurrentLesson.tag2].filter(Boolean).join(' · ') : 'No lessons'}</span>
                <button className="sc-lesson-arrow" onClick={() => setFormLessonIdx(i => Math.min(formLessons.length - 1, i + 1))} disabled={formLessonIdx >= formLessons.length - 1}><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
          <div className="sc-field">
            <span className="sc-field-label">HRT NAME</span>
            <input
              className="sc-input"
              placeholder="e.g. Ms. Tanaka"
              value={classForm.hrt_name}
              onChange={e => setClassForm(p => ({ ...p, hrt_name: e.target.value }))}
            />
          </div>
          <div className="sc-field">
            <span className="sc-field-label">STUDENTS</span>
            <input
              className="sc-input"
              placeholder="e.g. 28"
              type="number"
              value={classForm.student_count}
              onChange={e => setClassForm(p => ({ ...p, student_count: e.target.value }))}
            />
          </div>
        </div>
      </ResponsiveModal>

      {/* Delete School modal */}
      <ResponsiveModal
        isMobile={isMobile}
        open={deleteSchoolModal && !!deletingSchool}
        onClose={() => setDeleteSchoolModal(false)}
        title={`Delete ${deletingSchool?.name ?? ''}?`}
        footer={
          <>
            <button className="sc-form-cancel" onClick={() => setDeleteSchoolModal(false)}>Cancel</button>
            <button className="sc-form-danger" onClick={deleteSchool}><Trash2 size={14} /> Delete School</button>
          </>
        }
      >
        <div style={{padding:'12px 16px',background:'#FDEAEA',border:'0.5px solid #F5AAAA',borderRadius:10,fontFamily:"'Figtree',sans-serif",fontSize:14,color:'#C03030',lineHeight:1.6}}>
          By deleting <strong>{deletingSchool?.name}</strong> you will also delete <strong>{classCounts[deletingSchool?.id] ?? 0} {(classCounts[deletingSchool?.id] ?? 0) === 1 ? 'class' : 'classes'}</strong> and all associated schedule data. This action cannot be undone.
        </div>
      </ResponsiveModal>

      {/* New School modal */}
      <ResponsiveModal
        isMobile={isMobile}
        open={newSchoolModal}
        onClose={() => setNewSchoolModal(false)}
        title="New School"
        footer={
          <>
            <button className="sc-form-cancel" onClick={() => setNewSchoolModal(false)}>Cancel</button>
            <button className="sc-form-save" onClick={saveNewSchool}>Save</button>
          </>
        }
      >
        <div className="sc-panel-sub" style={{ marginBottom: 8 }}>School name</div>
        <input className="sc-input" placeholder="e.g. Yanai ES" value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNewSchool() }} autoFocus />
      </ResponsiveModal>
    </>
  )

  if (isMobile) {
    return (
      <div className="sc-mobile">
        {screen === 'list' && (
          <div className="hm-screen">
            {sidebarContent}
          </div>
        )}
        {screen === 'classes' && (
          <div className="hm-screen">
            <div className="hm-detail-topbar">
              <button className="hm-back-btn" onClick={() => setScreen('list')}>
                <ArrowLeft size={16} />
              </button>
              <span className="hm-detail-subtitle">{selectedSchool?.name} Classes</span>
              <button className="hm-edit-btn" onClick={openNewClass}>
                <Plus size={16} />
              </button>
              <button
                className="hm-edit-btn"
                onClick={() => { setDeletingSchool(selectedSchool); setDeleteSchoolModal(true) }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="sc-mobile-detail-body">
              {classList}
            </div>
          </div>
        )}
        {modals}
      </div>
    )
  }

  return (
    <Layout sidebar={<div className="sc-sidebar">{sidebarContent}</div>}>
      <div className="sc-main">
        <div className="sc-classes-panel">
          <div className="sc-panel-header">
            <span className="sc-panel-title">{selectedSchool?.name} Classes</span>
            <div style={{display:'flex',gap:8}}>
              <button className="sc-add-btn" onClick={openNewClass}>
                <Plus size={14} /> New Class
              </button>
              <button className="sc-more-btn" onClick={() => { setDeletingSchool(selectedSchool); setDeleteSchoolModal(true) }} title="Delete school">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {classList}
        </div>
      </div>
      {modals}
    </Layout>
  )
}