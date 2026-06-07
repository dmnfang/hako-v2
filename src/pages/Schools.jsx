import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import Layout from '../components/Layout'
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'
import './Schools.css'

const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_VALUES = [1, 2, 3, 4, 5]

function ClassForm({ classForm, setClassForm, formLessonIdx, setFormLessonIdx, editingClass, curricula, lessonsByCurriculum, onSave, onCancel, onDelete }) {
  const formLessons = lessonsByCurriculum[classForm.curriculum_id] ?? []
  const formCurrentLesson = formLessons[formLessonIdx]

  return (
    <div className="sc-class-form">
      <input className="sc-input" placeholder="Label (e.g. 3-1)" value={classForm.label} onChange={e => setClassForm(p => ({ ...p, label: e.target.value }))} />
      <select className="sc-select" value={classForm.curriculum_id} onChange={e => { setClassForm(p => ({ ...p, curriculum_id: e.target.value })); setFormLessonIdx(0) }}>
        <option value="">No course</option>
        {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {classForm.curriculum_id && (
        <div className="sc-lesson-picker">
          <span className="sc-lesson-picker-label">Current Lesson</span>
          <div className="sc-lesson-picker-row">
            <button className="sc-lesson-arrow" onClick={() => setFormLessonIdx(i => Math.max(0, i - 1))} disabled={formLessonIdx === 0}><ChevronLeft size={14} /></button>
            <span className="sc-lesson-picker-val">{formCurrentLesson ? [formCurrentLesson.tag1, formCurrentLesson.tag2].filter(Boolean).join(' · ') : 'No lessons'}</span>
            <button className="sc-lesson-arrow" onClick={() => setFormLessonIdx(i => Math.min(formLessons.length - 1, i + 1))} disabled={formLessonIdx >= formLessons.length - 1}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
      <input className="sc-input" placeholder="HRT name" value={classForm.hrt_name} onChange={e => setClassForm(p => ({ ...p, hrt_name: e.target.value }))} />
      <input className="sc-input" placeholder="Students" type="number" value={classForm.student_count} onChange={e => setClassForm(p => ({ ...p, student_count: e.target.value }))} />
      <div className="sc-form-actions">
        {editingClass !== 'new' && (
          <button className="sc-form-delete" onClick={onDelete}>Delete</button>
        )}
        <div className="sc-form-actions-right">
          <button className="sc-form-cancel" onClick={onCancel}>Cancel</button>
          <button className="sc-form-save" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function Schools() {
  const { schools, curricula, lessonsByCurriculum, progress: classProgressCtx, refresh: refreshData } = useData()
  const [selectedSchoolId, setSelectedSchoolId] = useState(null)
  const [classes, setClasses] = useState([])
  const [classCounts, setClassCounts] = useState({})
  const [schoolPeriods, setSchoolPeriods] = useState({})
  const [editingClass, setEditingClass] = useState(null)
  const [classForm, setClassForm] = useState({ label: '', curriculum_id: '', hrt_name: '', student_count: '' })
  const [formLessonIdx, setFormLessonIdx] = useState(0)
  const [editingRefPeriod, setEditingRefPeriod] = useState(null)
  const [refPeriodForm, setRefPeriodForm] = useState({ start_time: '', end_time: '' })
  const [selectedDay, setSelectedDay] = useState(1)
  const [newSchoolModal, setNewSchoolModal] = useState(false)
  const [newSchoolName, setNewSchoolName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchBase() }, [])
  useEffect(() => { if (selectedSchoolId) fetchSchoolClasses() }, [selectedSchoolId])

  async function fetchBase() {
    const [{ data: classData }, { data: spData }] = await Promise.all([
      supabase.from('classes').select('id, school_id'),
      supabase.from('school_periods').select('*'),
    ])

    const counts = {}
    classData?.forEach(c => { counts[c.school_id] = (counts[c.school_id] ?? 0) + 1 })

    const sp = {}
    spData?.forEach(p => {
      if (!sp[p.school_id]) sp[p.school_id] = {}
      sp[p.school_id][p.period_number] = p
    })

    setClassCounts(counts)
    setSchoolPeriods(sp)
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

    setEditingClass(null)
    setClassForm({ label: '', curriculum_id: '', hrt_name: '', student_count: '' })
    fetchSchoolClasses()
    fetchBase()
    refreshData()
  }

  async function deleteClass(id) {
    await supabase.from('classes').delete().eq('id', id)
    setEditingClass(null)
    fetchSchoolClasses()
    fetchBase()
    refreshData()
  }

  async function saveRefPeriod(periodNumber) {
    const { start_time, end_time } = refPeriodForm
    if (!start_time || !end_time) return

    await supabase.from('school_periods').upsert({
      school_id: selectedSchoolId, period_number: periodNumber, start_time, end_time
    }, { onConflict: 'school_id,period_number' })

    const { data: schoolDayIds } = await supabase
      .from('school_days').select('id').eq('school_id', selectedSchoolId)

    if (schoolDayIds?.length > 0) {
      const ids = schoolDayIds.map(sd => sd.id)
      await supabase.from('periods')
        .update({ start_time, end_time })
        .in('school_day_id', ids)
        .eq('period_number', periodNumber)
        .is('start_time', null)
    }

    setEditingRefPeriod(null)
    fetchBase()
  }

  function getCurriculumName(curriculumId) {
    return curricula.find(c => c.id === curriculumId)?.name ?? ''
  }

  const selectedSchool = schools.find(s => s.id === selectedSchoolId)
  const selectedSchoolRefPeriods = schoolPeriods[selectedSchoolId] ?? {}

  if (loading) return <Layout sidebar={<div />}><div /></Layout>

  const sidebar = (
    <div className="sc-sidebar">
      <div className="sc-sidebar-header">
        <h1 className="sc-sidebar-title">Schools</h1>
        <button className="sc-new-btn" onClick={() => { setNewSchoolName(''); setNewSchoolModal(true) }}>
          <Plus size={14} /> New School
        </button>
      </div>
      <div className="sc-list">
        {schools.map(s => (
          <div
            key={s.id}
            className={`sc-row ${selectedSchoolId === s.id ? 'selected' : ''}`}
            onClick={() => setSelectedSchoolId(s.id)}
          >
            <div className="sc-row-top">
              <span className="sc-row-name">{s.name}</span>
              <span className="sc-row-count">{classCounts[s.id] ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Layout sidebar={sidebar}>
      <div className="sc-main">

        {/* ── CLASSES PANEL ── */}
        <div className="sc-classes-panel">
          <div className="sc-panel-header">
            <span className="sc-panel-title">{selectedSchool?.name} Classes</span>
            <button className="sc-add-btn" onClick={openNewClass}>
              <Plus size={14} /> New Class
            </button>
          </div>

          <div className="sc-class-list">
            {classes.length === 0 && editingClass !== 'new' && (
              <div className="sc-empty">No classes yet.</div>
            )}

            {editingClass === 'new' && (
              <ClassForm
                key="new"
                classForm={classForm}
                setClassForm={setClassForm}
                formLessonIdx={formLessonIdx}
                setFormLessonIdx={setFormLessonIdx}
                editingClass={editingClass}
                curricula={curricula}
                lessonsByCurriculum={lessonsByCurriculum}
                onSave={saveClass}
                onCancel={() => setEditingClass(null)}
                onDelete={() => deleteClass(editingClass)}
              />
            )}

            {classes.map(cls => {
              const isEditing = editingClass === cls.id
              const currentLesson = classProgressCtx[cls.id]?.current_lesson
              const currName = getCurriculumName(cls.curriculum_id)

              return (
                <div key={cls.id} className={`sc-class-row ${isEditing ? 'editing' : ''}`}>
                  {isEditing ? (
                    <ClassForm
                      key={cls.id}
                      classForm={classForm}
                      setClassForm={setClassForm}
                      formLessonIdx={formLessonIdx}
                      setFormLessonIdx={setFormLessonIdx}
                      editingClass={editingClass}
                      curricula={curricula}
                      lessonsByCurriculum={lessonsByCurriculum}
                      onSave={saveClass}
                      onCancel={() => setEditingClass(null)}
                      onDelete={() => deleteClass(cls.id)}
                    />
                  ) : (
                    <>
                      <div className="sc-class-body">
                        <span className="sc-class-label">{cls.label}</span>
                        {(cls.curriculum || currentLesson) && (
                          <div className="sc-class-curriculum-line">
                            {cls.curriculum && <span className="sc-class-curr-text">{currName}</span>}
                            {cls.curriculum && currentLesson?.tag1 && <span className="sc-class-curr-dot" />}
                            {currentLesson?.tag1 && <span className="sc-class-curr-text">{currentLesson.tag1}</span>}
                            {currentLesson?.tag1 && currentLesson?.tag2 && <span className="sc-class-curr-dot" />}
                            {currentLesson?.tag2 && <span className="sc-class-curr-text">{currentLesson.tag2}</span>}
                          </div>
                        )}
                        <div className="sc-class-chips">
                          {cls.curriculum && <span className="sc-chip sc-chip-grade">{cls.curriculum.grade_tag ?? cls.curriculum.name}</span>}
                          {cls.hrt_name && <span className="sc-chip sc-chip-teacher">{cls.hrt_name}</span>}
                          {cls.student_count && <span className="sc-chip sc-chip-students">{cls.student_count} students</span>}
                        </div>
                      </div>
                      <div className="sc-class-actions">
                        <button className="sc-class-btn" onClick={() => openEditClass(cls)}>Edit</button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── PERIODS PANEL ── */}
        <div className="sc-periods-panel">
          <div className="sc-panel-header">
            <span className="sc-panel-title">{selectedSchool?.name} Periods</span>
            <div className="sc-day-tabs">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  className={`sc-day-tab ${selectedDay === DAY_VALUES[i] ? 'active' : ''}`}
                  onClick={() => setSelectedDay(DAY_VALUES[i])}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="sc-period-list">
            {PERIOD_NUMBERS.map(num => {
              const ref = selectedSchoolRefPeriods[num]
              const editKey = `${selectedDay}-${num}`
              const isEditing = editingRefPeriod === editKey

              const openEdit = () => {
                setEditingRefPeriod(editKey)
                setRefPeriodForm({
                  start_time: ref?.start_time?.slice(0, 5) ?? '',
                  end_time: ref?.end_time?.slice(0, 5) ?? '',
                })
              }

              return (
                <div key={num} className="sc-period-row">
                  <span className="sc-period-num">Period {num}</span>
                  {isEditing ? (
                    <>
                      <div className="sc-ref-edit">
                        <input className="sc-time-input" type="time" value={refPeriodForm.start_time} onChange={e => setRefPeriodForm(p => ({ ...p, start_time: e.target.value }))} autoFocus />
                        <input className="sc-time-input" type="time" value={refPeriodForm.end_time} onChange={e => setRefPeriodForm(p => ({ ...p, end_time: e.target.value }))} />
                      </div>
                      <div className="sc-ref-actions">
                        <button className="sc-form-save" onClick={() => saveRefPeriod(num)}>Save</button>
                        <button className="sc-form-cancel" onClick={() => setEditingRefPeriod(null)}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div className="sc-ref-times">
                      <button className="sc-period-time-btn" onClick={openEdit}>{ref?.start_time?.slice(0, 5) ?? 'Start time'}</button>
                      <button className="sc-period-time-btn" onClick={openEdit}>{ref?.end_time?.slice(0, 5) ?? 'End time'}</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {newSchoolModal && (
        <div className="sc-modal-overlay" onClick={() => setNewSchoolModal(false)}>
          <div className="sc-modal" onClick={e => e.stopPropagation()}>
            <div className="sc-modal-header">
              <span className="sc-modal-title">New School</span>
              <button className="sc-modal-close" onClick={() => setNewSchoolModal(false)}><X size={14} /></button>
            </div>
            <div className="sc-modal-body">
              <div className="sc-panel-sub" style={{ marginBottom: 8 }}>School name</div>
              <input className="sc-input" placeholder="e.g. Yanai ES" value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNewSchool() }} autoFocus />
            </div>
            <div className="sc-modal-footer">
              <button className="sc-form-cancel" onClick={() => setNewSchoolModal(false)}>Cancel</button>
              <button className="sc-form-save" onClick={saveNewSchool}>Save</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}