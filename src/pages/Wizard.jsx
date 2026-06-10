import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { X, Check } from 'lucide-react'
import './Wizard.css'

const TEXTBOOKS = {
  es: [
    { value: 'original', label: 'Original' },
    { value: 'lets_try_1', label: "Let's Try 1" },
    { value: 'lets_try_2', label: "Let's Try 2" },
    { value: 'new_horizon_elementary_5', label: 'New Horizon Elementary 5' },
    { value: 'new_horizon_elementary_6', label: 'New Horizon Elementary 6' },
    { value: 'here_we_go_5', label: 'Here We Go! 5' },
    { value: 'here_we_go_6', label: 'Here We Go! 6' },
    { value: 'one_world_smiles_5', label: 'One World Smiles 5' },
    { value: 'one_world_smiles_6', label: 'One World Smiles 6' },
    { value: 'junior_sunshine_5', label: 'Junior Sunshine 5' },
    { value: 'junior_sunshine_6', label: 'Junior Sunshine 6' },
    { value: 'crown_jr_5', label: 'Crown Jr. 5' },
    { value: 'crown_jr_6', label: 'Crown Jr. 6' },
  ],
  jhs: [
    { value: 'original', label: 'Original' },
    { value: 'new_horizon_jhs', label: 'New Horizon' },
    { value: 'new_crown', label: 'New Crown' },
    { value: 'sunshine', label: 'Sunshine' },
    { value: 'one_world_jhs', label: 'One World' },
    { value: 'total_english', label: 'Total English' },
    { value: 'columbus_21', label: 'Columbus 21' },
  ],
  hs: [{ value: 'original', label: 'Original' }],
}

const DEFAULT_GRADE_TAG = {
  lets_try_1: 'Grade 3', lets_try_2: 'Grade 4',
  new_horizon_elementary_5: 'Grade 5', new_horizon_elementary_6: 'Grade 6',
  here_we_go_5: 'Grade 5', here_we_go_6: 'Grade 6',
  one_world_smiles_5: 'Grade 5', one_world_smiles_6: 'Grade 6',
  junior_sunshine_5: 'Grade 5', junior_sunshine_6: 'Grade 6',
  crown_jr_5: 'Grade 5', crown_jr_6: 'Grade 6',
  new_horizon_jhs: 'JHS', new_crown: 'JHS', sunshine: 'JHS',
  one_world_jhs: 'JHS', total_english: 'JHS', columbus_21: 'JHS',
  original: '',
}

const LESSON_SEEDS = {
  lets_try_1: [
    { unit: 1, count: 2 }, { unit: 2, count: 2 }, { unit: 3, count: 4 },
    { unit: 4, count: 4 }, { unit: 5, count: 4 }, { unit: 6, count: 4 },
    { unit: 7, count: 5 }, { unit: 8, count: 5 }, { unit: 9, count: 5 },
  ],
  lets_try_2: [
    { unit: 1, count: 2 }, { unit: 2, count: 4 }, { unit: 3, count: 3 },
    { unit: 4, count: 4 }, { unit: 5, count: 4 }, { unit: 6, count: 4 },
    { unit: 7, count: 5 }, { unit: 8, count: 4 }, { unit: 9, count: 5 },
  ],
  new_horizon_elementary_5: [
    { unit: 1, count: 8 }, { unit: 2, count: 8 }, { unit: 3, count: 8 },
    { unit: 'CYS1', count: 2 }, { unit: 4, count: 8 }, { unit: 5, count: 8 },
    { unit: 6, count: 8 }, { unit: 'CYS2', count: 2 }, { unit: 7, count: 8 },
    { unit: 8, count: 8 }, { unit: 'CYS3', count: 2 },
  ],
  new_horizon_elementary_6: [
    { unit: 1, count: 8 }, { unit: 2, count: 8 }, { unit: 3, count: 8 },
    { unit: 'CYS1', count: 2 }, { unit: 4, count: 8 }, { unit: 5, count: 8 },
    { unit: 6, count: 8 }, { unit: 'CYS2', count: 2 }, { unit: 7, count: 8 },
    { unit: 8, count: 8 }, { unit: 'CYS3', count: 2 },
  ],
}

function buildLessons(curriculumId, textbook) {
  const seed = LESSON_SEEDS[textbook]
  if (!seed) return []
  const lessons = []
  let sort = 1
  seed.forEach(({ unit, count }) => {
    const isSpecial = typeof unit === 'string'
    for (let i = 1; i <= count; i++) {
      const title = isSpecial ? `${unit} · Lesson ${i}` : `Unit ${unit} · Lesson ${i}`
      lessons.push({
        curriculum_id: curriculumId,
        unit: isSpecial ? null : unit,
        unit_label: isSpecial ? unit : null,
        lesson_number: i,
        title,
        tag1: isSpecial ? unit : `Unit ${unit}`,
        tag2: `Lesson ${i}`,
        sort_order: sort++,
      })
    }
  })
  return lessons
}

export default function Wizard({ onComplete }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [levels, setLevels] = useState({ es: true, jhs: false, hs: false })
  const [curricula, setCurricula] = useState([])
  const [newCurriculum, setNewCurriculum] = useState({ name: '', gradeTag: '', textbook: 'original', level: 'es' })

  const [schools, setSchools] = useState([])
  const [newSchoolName, setNewSchoolName] = useState('')
  const [newSchoolLevel, setNewSchoolLevel] = useState('es')

  const [classes, setClasses] = useState({})
  const [newClass, setNewClass] = useState({})
  const [activeSchoolId, setActiveSchoolId] = useState(null)

  const activeLevels = Object.entries(levels).filter(([, v]) => v).map(([k]) => k)

  function toggleLevel(l) {
    setLevels(prev => ({ ...prev, [l]: !prev[l] }))
  }

  function updateTextbook(textbook) {
    const gradeTag = DEFAULT_GRADE_TAG[textbook] ?? ''
    const name = textbook === 'original' ? newCurriculum.name
      : (TEXTBOOKS[newCurriculum.level]?.find(t => t.value === textbook)?.label ?? newCurriculum.name)
    setNewCurriculum(prev => ({ ...prev, textbook, gradeTag, name }))
  }

  function addCurriculum() {
    if (!newCurriculum.name.trim()) return
    setCurricula(prev => [...prev, { ...newCurriculum, id: crypto.randomUUID() }])
    setNewCurriculum({ name: '', gradeTag: '', textbook: 'original', level: activeLevels[0] ?? 'es' })
  }

  function addSchool() {
    if (!newSchoolName.trim()) return
    const school = { id: crypto.randomUUID(), name: newSchoolName.trim(), level: newSchoolLevel }
    setSchools(prev => [...prev, school])
    setClasses(prev => ({ ...prev, [school.id]: [] }))
    setNewClass(prev => ({ ...prev, [school.id]: { label: '', curriculumId: '' } }))
    setNewSchoolName('')
    setActiveSchoolId(school.id)
  }

  function addClass(schoolId) {
    const nc = newClass[schoolId]
    if (!nc?.label?.trim()) return
    const cls = { id: crypto.randomUUID(), label: nc.label.trim(), curriculumId: nc.curriculumId ?? '' }
    setClasses(prev => ({ ...prev, [schoolId]: [...(prev[schoolId] ?? []), cls] }))
    setNewClass(prev => ({ ...prev, [schoolId]: { label: '', curriculumId: '' } }))
  }

  const allSchoolsHaveClasses = schools.length > 0 && schools.every(s => (classes[s.id] ?? []).length > 0)
  const activeSchool = schools.find(s => s.id === activeSchoolId)
  const activeClasses = activeSchoolId ? (classes[activeSchoolId] ?? []) : []

  async function handleFinish() {
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user.id
      const curriculumIdMap = {}

      // 1. Insert curricula + lessons
      for (const [i, c] of curricula.entries()) {
        const { data: currRow, error: currErr } = await supabase
          .from('curricula')
          .insert({ name: c.name, grade_tag: c.gradeTag, sort_order: i, user_id: uid })
          .select().single()
        if (currErr) throw currErr
        curriculumIdMap[c.id] = currRow.id

        const lessons = buildLessons(currRow.id, c.textbook)
        if (lessons.length > 0) {
          const { error: lessonErr } = await supabase.from('lessons').insert(lessons)
          if (lessonErr) throw lessonErr
        }
      }

      // 2. Insert schools + classes only — schedule is set up in the app
      for (const [si, school] of schools.entries()) {
        const { data: schoolRow, error: schoolErr } = await supabase
          .from('schools')
          .insert({ name: school.name, sort_order: si, user_id: uid })
          .select().single()
        if (schoolErr) throw schoolErr

        const schoolClasses = classes[school.id] ?? []
        for (const [ci, cls] of schoolClasses.entries()) {
          const { error: clsErr } = await supabase.from('classes').insert({
            school_id: schoolRow.id,
            curriculum_id: curriculumIdMap[cls.curriculumId] ?? null,
            label: cls.label,
            sort_order: ci,
          })
          if (clsErr) throw clsErr
        }
      }

      onComplete()
      navigate('/home')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="wizard-shell">
      <div className="wizard-card">

        {/* Progress */}
        <div className="wizard-progress">
          {[1, 2, 3].map(n => (
            <div key={n} className="wz-step-wrap">
              <div className={`wz-dot ${step === n ? 'active' : step > n ? 'done' : ''}`}>
                {step > n ? <Check size={14} /> : n}
              </div>
              {n < 3 && <div className={`wz-line ${step > n ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Courses */}
        {step === 1 && (
          <div>
            <div className="wz-title">What school levels do you teach?</div>
            <div className="wz-sub">Select all that apply — this shapes which textbooks appear below.</div>
            <div className="level-chips">
              {[{key:'es',label:'Elementary'},{key:'jhs',label:'Junior High'},{key:'hs',label:'High School'}].map(({ key, label }) => (
                <button key={key} type="button" className={`level-chip ${levels[key] ? 'active' : ''}`} onClick={() => toggleLevel(key)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="wz-section-title">Courses</div>
            <div className="wz-sub">A course is a named set of lessons — one per textbook or class type. The grade tag is the short label shown on class cards, like "Grade 3" or "SNC".</div>

            <div className="curricula-list">
              {curricula.map(c => (
                <div key={c.id} className="curriculum-item">
                  <div className="ci-name">{c.name}</div>
                  {c.gradeTag && <span className="ci-tag">{c.gradeTag}</span>}
                  <span className="ci-book">{TEXTBOOKS[c.level]?.find(t => t.value === c.textbook)?.label ?? c.textbook}</span>
                  <button className="remove-btn" onClick={() => setCurricula(prev => prev.filter(x => x.id !== c.id))}><X size={12} /></button>
                </div>
              ))}
            </div>

            <div className="curriculum-form">
              <div className="wz-field-label">TEXTBOOK</div>
              <div className="curriculum-form-row">
                <select value={newCurriculum.level} onChange={e => setNewCurriculum(prev => ({ ...prev, level: e.target.value, textbook: 'original' }))} style={{flex:'0 0 76px'}}>
                  {activeLevels.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
                <select value={newCurriculum.textbook} onChange={e => updateTextbook(e.target.value)}>
                  {(TEXTBOOKS[newCurriculum.level] ?? TEXTBOOKS.es).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="wz-field-label" style={{marginTop:4}}>COURSE NAME &amp; GRADE TAG</div>
              <div className="curriculum-form-row">
                <input placeholder="e.g. Let's Try 1" value={newCurriculum.name} onChange={e => setNewCurriculum(prev => ({ ...prev, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addCurriculum()} />
                <input placeholder="e.g. Grade 3" value={newCurriculum.gradeTag} onChange={e => setNewCurriculum(prev => ({ ...prev, gradeTag: e.target.value }))} style={{flex:'0 0 140px'}} onKeyDown={e => e.key === 'Enter' && addCurriculum()} />
                <button className="confirm-btn" onClick={addCurriculum} disabled={!newCurriculum.name.trim()}><Check size={14} /></button>
              </div>
            </div>

            <div className="wz-btn-row">
              <span />
              <button className="wz-btn-next" onClick={() => setStep(2)} disabled={curricula.length === 0}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Schools */}
        {step === 2 && (
          <div>
            <div className="wz-title">Add your schools</div>
            <div className="wz-sub">Add each school you teach at. You'll set up your weekly schedule in the app after this.</div>

            <div className="school-list">
              {schools.map(s => (
                <div key={s.id} className="school-item">
                  <span className="school-name">{s.name}</span>
                  <span className="school-level-tag">{s.level.toUpperCase()}</span>
                  <button className="remove-btn" style={{marginLeft:'auto'}} onClick={() => {
                    setSchools(prev => { const u = prev.filter(x => x.id !== s.id); if (activeSchoolId === s.id) setActiveSchoolId(u[0]?.id ?? null); return u })
                    setClasses(prev => { const n = {...prev}; delete n[s.id]; return n })
                  }}><X size={12} /></button>
                </div>
              ))}
            </div>

            <div className="curriculum-form">
              <div className="wz-field-label">SCHOOL NAME</div>
              <div className="curriculum-form-row">
                <input placeholder="e.g. Oda Elementary School" value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSchool()} />
                <select value={newSchoolLevel} onChange={e => setNewSchoolLevel(e.target.value)} style={{flex:'0 0 76px'}}>
                  {activeLevels.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
                <button className="confirm-btn" onClick={addSchool} disabled={!newSchoolName.trim()}><Check size={14} /></button>
              </div>
            </div>

            <div className="wz-btn-row">
              <button className="wz-btn-back" onClick={() => setStep(1)}>← Back</button>
              <button className="wz-btn-next" onClick={() => { setActiveSchoolId(schools[0]?.id ?? null); setStep(3) }} disabled={schools.length === 0}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Classes */}
        {step === 3 && (
          <div>
            <div className="wz-title">Add classes to each school</div>
            <div className="wz-sub">Each school needs at least one class. You'll assign classes to specific periods in Schedule after setup.</div>

            <div className="school-tabs">
              {schools.map(s => {
                const hasClasses = (classes[s.id] ?? []).length > 0
                return (
                  <button key={s.id} className={`school-tab ${activeSchoolId === s.id ? 'active' : ''} ${hasClasses ? 'has-classes' : ''}`} onClick={() => setActiveSchoolId(s.id)}>
                    {s.name}
                    {hasClasses && <span className="school-tab-check"><Check size={11} /></span>}
                  </button>
                )
              })}
            </div>

            {activeSchool && (
              <div className="class-section">
                <div className="class-list">
                  {activeClasses.map(c => {
                    const curr = curricula.find(cu => cu.id === c.curriculumId)
                    return (
                      <div key={c.id} className="class-item">
                        <span className="ci-label">{c.label}</span>
                        {curr?.gradeTag && <span className="ci-grade">{curr.gradeTag}</span>}
                        {curr && <span className="ci-book-sm">{TEXTBOOKS[curr.level]?.find(t => t.value === curr.textbook)?.label ?? curr.name}</span>}
                        <button className="remove-btn" style={{marginLeft:'auto'}} onClick={() => setClasses(prev => ({ ...prev, [activeSchool.id]: prev[activeSchool.id].filter(x => x.id !== c.id) }))}><X size={12} /></button>
                      </div>
                    )
                  })}
                </div>

                <div className="curriculum-form">
                  <div className="wz-field-label">CLASS LABEL &amp; COURSE</div>
                  <div className="class-add-row">
                    <input
                      placeholder="e.g. 3-1"
                      value={newClass[activeSchool.id]?.label ?? ''}
                      onChange={e => setNewClass(prev => ({ ...prev, [activeSchool.id]: { ...prev[activeSchool.id], label: e.target.value } }))}
                      onKeyDown={e => e.key === 'Enter' && addClass(activeSchool.id)}
                      style={{flex:'0 0 100px'}}
                    />
                    <select
                      value={newClass[activeSchool.id]?.curriculumId ?? ''}
                      onChange={e => setNewClass(prev => ({ ...prev, [activeSchool.id]: { ...prev[activeSchool.id], curriculumId: e.target.value } }))}
                    >
                      <option value="">No course</option>
                      {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button className="confirm-btn" onClick={() => addClass(activeSchool.id)} disabled={!newClass[activeSchool.id]?.label?.trim()}><Check size={14} /></button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div style={{marginTop:12,padding:'10px 14px',background:'#FDEAEA',border:'0.5px solid #F5AAAA',borderRadius:8,fontFamily:"'Figtree',sans-serif",fontSize:13,color:'#C03030'}}>
                {error}
              </div>
            )}

            <div className="wz-btn-row">
              <button className="wz-btn-back" onClick={() => setStep(2)}>← Back</button>
              <button className="wz-btn-finish" onClick={handleFinish} disabled={saving || !allSchoolsHaveClasses}>
                {saving ? 'Setting up…' : 'Finish setup →'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}