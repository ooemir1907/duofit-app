'use client'


import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Duo, DailyEntry, Measurement, Comment, User } from '@/lib/types'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [duo, setDuo] = useState<Duo | null>(null)
  const [partner, setPartner] = useState<User | null>(null)
  const [myEntries, setMyEntries] = useState<DailyEntry[]>([])
  const [partnerEntries, setPartnerEntries] = useState<DailyEntry[]>([])
  const [myMeasures, setMyMeasures] = useState<Measurement[]>([])
  const [partnerMeasures, setPartnerMeasures] = useState<Measurement[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const commentRef = useRef('')
  const [activeTab, setActiveTab] = useState<'dashboard'|'entry'|'measures'|'history'|'report'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Entry form state
  const [entryDate, setEntryDate] = useState(today())
  const [cal, setCal] = useState('')
  const [calGoal, setCalGoal] = useState('')
  const [protein, setProtein] = useState('')
  const [proteinGoal, setProteinGoal] = useState('')
  const [water, setWater] = useState('')
  const [steps, setSteps] = useState('')
  const [activities, setActivities] = useState<{type:string,duration:string,burned:string}[]>([])

  // Measure form state
  const [measDate, setMeasDate] = useState(today())
  const [measWeight, setMeasWeight] = useState('')
  const [measHeight, setMeasHeight] = useState('')
  const [measNeck, setMeasNeck] = useState('')
  const [measShoulder, setMeasShoulder] = useState('')
  const [measChest, setMeasChest] = useState('')
  const [measWaist, setMeasWaist] = useState('')
  const [measHip, setMeasHip] = useState('')
  const [measArm, setMeasArm] = useState('')
  const [measLeg, setMeasLeg] = useState('')

  function today() { return new Date().toISOString().split('T')[0] }

  useEffect(() => { 
  loadAll()
}, [])

useEffect(() => {
  if (!duo) return
  const channel = supabase
    .channel('comments')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'comments',
      filter: `duo_id=eq.${duo.id}`
    }, () => { loadAll() })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [duo])

  async function loadAll() {
    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.push('/auth/login'); return }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
    if (!profile) { router.push('/auth/login'); return }
    setUser(profile)

    const { data: duoData } = await supabase.from('duos').select('*')
      .or(`user_a.eq.${authUser.id},user_b.eq.${authUser.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!duoData) { router.push('/onboarding'); return }
    setDuo(duoData)

    if (duoData.status === 'active') {
      const partnerId = duoData.user_a === authUser.id ? duoData.user_b : duoData.user_a
      const { data: partnerProfile } = await supabase.from('profiles').select('*').eq('id', partnerId).single()
      setPartner(partnerProfile)

      const { data: myE } = await supabase.from('daily_entries').select('*').eq('user_id', authUser.id).eq('duo_id', duoData.id).order('date', { ascending: false })
      const { data: partE } = await supabase.from('daily_entries').select('*').eq('user_id', partnerId).eq('duo_id', duoData.id).order('date', { ascending: false })
      setMyEntries(myE || [])
      setPartnerEntries(partE || [])

      const { data: myM } = await supabase.from('measurements').select('*').eq('user_id', authUser.id).eq('duo_id', duoData.id).order('date', { ascending: false })
      const { data: partM } = await supabase.from('measurements').select('*').eq('user_id', partnerId).eq('duo_id', duoData.id).order('date', { ascending: false })
      setMyMeasures(myM || [])
      setPartnerMeasures(partM || [])

      const { data: comm } = await supabase.from('comments').select('*, author:profiles(*)').eq('duo_id', duoData.id).order('created_at', { ascending: false }).limit(20)
      setComments(comm || [])
    }
    setLoading(false)
  }

  async function saveEntry() {
    if (!user || !duo) return
    setSaving(true)
    const acts = activities.filter(a => a.type).map(a => ({ type: a.type, duration: parseFloat(a.duration) || 0, burned: parseFloat(a.burned) || 0 }))
    const totalBurned = acts.reduce((s, a) => s + a.burned, 0)
    const totalWorkout = acts.reduce((s, a) => s + a.duration, 0)
    const entry = {
      user_id: user.id, duo_id: duo.id, date: entryDate,
      calories: parseInt(cal) || null, calories_goal: parseInt(calGoal) || null,
      protein: parseFloat(protein) || null, protein_goal: parseFloat(proteinGoal) || null,
      water: parseFloat(water) || null, steps: parseInt(steps) || null,
      activities: acts, total_burned: totalBurned || null, total_workout: totalWorkout || null
    }
    await supabase.from('daily_entries').upsert(entry, { onConflict: 'user_id,date' })
    setSaving(false)
    loadAll()
    setActiveTab('dashboard')
  }

  async function saveMeasure() {
    if (!user || !duo) return
    setSaving(true)
    const m = {
      user_id: user.id, duo_id: duo.id, date: measDate,
      weight: parseFloat(measWeight) || null, height: parseFloat(measHeight) || null,
      neck: parseFloat(measNeck) || null, shoulder: parseFloat(measShoulder) || null,
      chest: parseFloat(measChest) || null, waist: parseFloat(measWaist) || null,
      hip: parseFloat(measHip) || null, arm: parseFloat(measArm) || null,
      leg: parseFloat(measLeg) || null
    }
    await supabase.from('measurements').upsert(m, { onConflict: 'user_id,date' })
    setSaving(false)
    loadAll()
  }

  async function sendComment() {
  const content = commentRef.current.trim()
  if (!user || !duo || !content) return
  const input = document.getElementById('commentInput') as HTMLInputElement
  if (input) input.value = ''
  commentRef.current = ''
  await supabase.from('comments').insert({ duo_id: duo.id, user_id: user.id, content })
  loadAll()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // ── STYLES ──
  const c = {
    bg: '#0d0f14', surface: '#13161e', surface2: '#1a1e29', border: '#252a38',
    a: '#6ee7b7', b: '#f472b6', text: '#e8eaf0', muted: '#6b7280', danger: '#f87171', gold: '#fbbf24'
  }

  const myColor = c.a
  const partnerColor = c.b

  function Card({ children, style }: any) {
    return <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, overflow: 'hidden', ...style }}>{children}</div>
  }

  function Label({ children }: any) {
    return <div style={{ fontSize: 11, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{children}</div>
  }

  function Input({ value, onChange, ...props }: any) {
    return <input value={value} onChange={e => onChange(e.target.value)}
      style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }}
      {...props} />
  }

  function SectionTitle({ children }: any) {
    return <div style={{ fontSize: 11, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, borderTop: `1px solid ${c.border}`, paddingTop: 12, marginTop: 4 }}>{children}</div>
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'sans-serif' }}>
      <div style={{ fontWeight: 800, fontSize: 28 }}><span style={{ color: c.a }}>Duo</span><span style={{ color: c.b }}>Fit</span></div>
      <div style={{ color: c.muted }}>Yükleniyor...</div>
    </div>
  )

  // Duo henüz aktif değil (bekliyor)
  if (duo && duo.status === 'pending') return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, padding: '40px 48px', width: 400, display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 28 }}><span style={{ color: c.a }}>Duo</span><span style={{ color: c.b }}>Fit</span></div>
        <div style={{ color: c.text, fontSize: 16, fontWeight: 600 }}>Arkadaşını bekliyorsun 🕐</div>
        <div style={{ background: c.surface2, border: `2px solid ${c.a}`, borderRadius: 12, padding: 20 }}>
          <div style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>DAVET KODUN</div>
          <div style={{ color: c.a, fontSize: 36, fontWeight: 800, letterSpacing: 8, fontFamily: 'monospace' }}>{duo.invite_code}</div>
        </div>
        <div style={{ color: c.muted, fontSize: 13 }}>Arkadaşın bu kodu girince duo'nuz aktif olacak</div>
        <button onClick={() => { navigator.clipboard.writeText(duo.invite_code); alert('Kopyalandı!') }}
          style={{ background: c.a, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
          📋 Kodu Kopyala
        </button>
        <button onClick={loadAll} style={{ background: 'none', border: `1px solid ${c.border}`, color: c.muted, borderRadius: 10, padding: 10, cursor: 'pointer', fontSize: 13 }}>
          🔄 Yenile
        </button>
      </div>
    </div>
  )

  const todayStr = today()
  const myToday = myEntries.find(e => e.date === todayStr)
  const partnerToday = partnerEntries.find(e => e.date === todayStr)
  const myLatestMeas = myMeasures[0]
  const partnerLatestMeas = partnerMeasures[0]

  function calcStreak(entries: DailyEntry[]) {
    const days = [...new Set(entries.filter(e => e.calories || e.total_workout || e.steps).map(e => e.date))].sort().reverse()
    if (!days.length) return 0
    let s = 0, cur = new Date(); cur.setHours(0, 0, 0, 0)
    for (const d of days) { const dd = new Date(d); dd.setHours(0, 0, 0, 0); if (Math.round((cur.getTime() - dd.getTime()) / 86400000) <= 1) { s++; cur = dd } else break }
    return s
  }

  function ProgressBar({ value, goal, color }: { value: number | null, goal: number | null, color: string }) {
    const pct = value && goal ? Math.min(100, Math.round(value / goal * 100)) : 0
    return <div style={{ height: 6, background: c.surface2, borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s' }} />
    </div>
  }

  function UserPanel({ name, color, entry, meas, streak }: any) {
    return <Card>
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${color}20`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>{name[0].toUpperCase()}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
          <div style={{ fontSize: 11, color: c.muted }}>Seri: <span style={{ color: c.gold }}>{streak}</span> gün 🔥</div>
        </div>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!entry ? <div style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Bugün henüz veri girilmedi.</div> : <>
          {entry.calories && <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: c.muted, fontSize: 12 }}>KALORİ</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{entry.calories} <span style={{ color: c.muted, fontSize: 11 }}>/ {entry.calories_goal || '?'} kcal</span></span>
            </div>
            <ProgressBar value={entry.calories} goal={entry.calories_goal} color={color} />
          </div>}
          {entry.protein && <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: c.muted, fontSize: 12 }}>PROTEİN</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{entry.protein}g <span style={{ color: c.muted, fontSize: 11 }}>/ {entry.protein_goal || '?'}g</span></span>
            </div>
            <ProgressBar value={entry.protein} goal={entry.protein_goal} color={color} />
          </div>}
          {entry.water && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.muted, fontSize: 12 }}>SU</span><span style={{ fontWeight: 700 }}>💧 {entry.water}L</span></div>}
          {entry.steps && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.muted, fontSize: 12 }}>ADIM</span><span style={{ fontWeight: 700 }}>👟 {entry.steps.toLocaleString('tr')}</span></div>}
          {entry.activities?.length > 0 && <div>
            <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>AKTİVİTELER</div>
            {entry.activities.map((a: any, i: number) => <div key={i} style={{ fontSize: 13 }}>{a.type} {a.duration}dk {a.burned ? `· 🔥${a.burned}kcal` : ''}</div>)}
          </div>}
          {entry.total_burned && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.muted, fontSize: 12 }}>YAKILAN</span><span style={{ fontWeight: 700 }}>🔥 {entry.total_burned} kcal</span></div>}
          {meas?.weight && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.muted, fontSize: 12 }}>KİLO</span><span style={{ fontWeight: 700 }}>⚖️ {meas.weight}kg</span></div>}
        </>}
      </div>
    </Card>
  }

  const WORKOUT_TYPES = ['Ağırlık', 'Koşu', 'HIIT', 'Yüzme', 'Bisiklet', 'Yoga', 'Yürüyüş', 'Kürek', 'Diğer']

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, fontFamily: 'sans-serif' }}>
      {/* NAV */}
      <nav style={{ background: c.surface, borderBottom: `1px solid ${c.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}><span style={{ color: c.a }}>Duo</span><span style={{ color: c.b }}>Fit</span></div>
        <div style={{ display: 'flex', gap: 4, background: c.surface2, borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
          {(['dashboard', 'entry', 'measures', 'history', 'report'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: '7px 13px', borderRadius: 9, border: 'none', background: activeTab === tab ? c.surface : 'none', color: activeTab === tab ? c.text : c.muted, fontWeight: 600, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {tab === 'dashboard' ? 'Dashboard' : tab === 'entry' ? 'Veri Gir' : tab === 'measures' ? 'Ölçümler' : tab === 'history' ? 'Geçmiş' : 'Rapor'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: myColor }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>{user?.username}</span>
          <button onClick={logout} style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.muted, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Çıkış</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 26 }}>Bugünkü Durum</div>
              <div style={{ color: c.muted, fontSize: 13 }}>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <button onClick={loadAll} style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text, borderRadius: 8, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>🔄 Yenile</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <UserPanel name={user?.username || ''} color={myColor} entry={myToday} meas={myLatestMeas} streak={calcStreak(myEntries)} />
            <UserPanel name={partner?.username || 'Arkadaşın'} color={partnerColor} entry={partnerToday} meas={partnerLatestMeas} streak={calcStreak(partnerEntries)} />
          </div>

          {/* YORUMLAR */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}`, fontWeight: 700 }}>💬 Duo Sohbeti</div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
              {comments.length === 0 && <div style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>Henüz mesaj yok. İlk sen yaz!</div>}
              {comments.map(comm => (
                <div key={comm.id} style={{ display: 'flex', gap: 10, flexDirection: (comm as any).author?.id === user?.id ? 'row-reverse' : 'row' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: (comm as any).author?.id === user?.id ? `${myColor}20` : `${partnerColor}20`, color: (comm as any).author?.id === user?.id ? myColor : partnerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                    {(comm as any).author?.username?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ background: c.surface2, borderRadius: 12, padding: '8px 14px', maxWidth: '70%' }}>
                    <div style={{ fontSize: 13 }}>{comm.content}</div>
                    <div style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>{new Date(comm.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${c.border}`, display: 'flex', gap: 10 }}>
              <input
                defaultValue=""
                onChange={e => { commentRef.current = e.target.value }}
                onKeyDown={e => e.key === 'Enter' && sendComment()}
                placeholder="Bir şeyler yaz... 💪"
                style={{ flex: 1, background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none' }} />
              <button onClick={sendComment} style={{ background: myColor, color: '#0d0f14', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Gönder</button>
            </div>
          </Card>
        </>}

        {/* VERİ GİR */}
        {activeTab === 'entry' && <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 22 }}>Veri Girişi</div>
            <div style={{ color: c.muted, fontSize: 13 }}>Günlük verilerini gir</div>
          </div>
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${myColor}20`, color: myColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{user?.username?.[0]?.toUpperCase()}</div>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{user?.username}</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><Label>Tarih</Label><Input type="date" value={entryDate} onChange={setEntryDate} /></div>

              <SectionTitle>🥗 Beslenme</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Label>Kalori (kcal)</Label><Input type="number" value={cal} onChange={setCal} placeholder="2000" /></div>
                <div><Label>Kalori Hedef</Label><Input type="number" value={calGoal} onChange={setCalGoal} placeholder="2200" /></div>
                <div><Label>Protein (g)</Label><Input type="number" value={protein} onChange={setProtein} placeholder="150" /></div>
                <div><Label>Protein Hedef (g)</Label><Input type="number" value={proteinGoal} onChange={setProteinGoal} placeholder="160" /></div>
              </div>
              <div><Label>Su (litre)</Label><Input type="number" value={water} onChange={setWater} placeholder="2.5" step="0.1" /></div>

              <SectionTitle>🏃 Aktiviteler</SectionTitle>
              {activities.map((a, i) => (
                <div key={i} style={{ background: c.surface2, borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: '1fr 80px 80px 28px', gap: 8, alignItems: 'center' }}>
                  <select value={a.type} onChange={e => { const n = [...activities]; n[i].type = e.target.value; setActivities(n) }}
                    style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text, borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
                    <option value="">Tür seç...</option>
                    {WORKOUT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input type="number" placeholder="dk" value={a.duration} onChange={e => { const n = [...activities]; n[i].duration = e.target.value; setActivities(n) }}
                    style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%' }} />
                  <input type="number" placeholder="kcal" value={a.burned} onChange={e => { const n = [...activities]; n[i].burned = e.target.value; setActivities(n) }}
                    style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%' }} />
                  <button onClick={() => setActivities(activities.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: c.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ))}
              <button onClick={() => setActivities([...activities, { type: '', duration: '', burned: '' }])}
                style={{ background: 'none', border: `1px dashed ${c.border}`, color: c.muted, borderRadius: 10, padding: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                + Aktivite Ekle
              </button>
              <div><Label>Adım Sayısı</Label><Input type="number" value={steps} onChange={setSteps} placeholder="8000" /></div>

              <button onClick={saveEntry} disabled={saving}
                style={{ background: myColor, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Kaydediliyor...' : 'Kaydet ✓'}
              </button>
            </div>
          </Card>
        </>}

        {/* ÖLÇÜMLER */}
        {activeTab === 'measures' && <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 22 }}>Vücut Ölçümleri</div>
            <div style={{ color: c.muted, fontSize: 13 }}>Haftalık veya aylık ölçümlerini kaydet</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
            {[{ u: user, color: myColor, measures: myMeasures, fields: [
              { label: 'Tarih', el: <Input type="date" value={measDate} onChange={setMeasDate} /> },
              { label: 'Kilo (kg)', el: <Input type="number" value={measWeight} onChange={setMeasWeight} step="0.1" placeholder="70.0" /> },
              { label: 'Boy (cm)', el: <Input type="number" value={measHeight} onChange={setMeasHeight} placeholder="175" /> },
              { label: 'Boyun (cm)', el: <Input type="number" value={measNeck} onChange={setMeasNeck} placeholder="38" /> },
              { label: 'Omuz (cm)', el: <Input type="number" value={measShoulder} onChange={setMeasShoulder} placeholder="44" /> },
              { label: 'Göğüs (cm)', el: <Input type="number" value={measChest} onChange={setMeasChest} placeholder="90" /> },
              { label: 'Bel (cm)', el: <Input type="number" value={measWaist} onChange={setMeasWaist} placeholder="80" /> },
              { label: 'Kalça (cm)', el: <Input type="number" value={measHip} onChange={setMeasHip} placeholder="95" /> },
              { label: 'Kol (cm)', el: <Input type="number" value={measArm} onChange={setMeasArm} placeholder="32" /> },
              { label: 'Bacak (cm)', el: <Input type="number" value={measLeg} onChange={setMeasLeg} placeholder="55" /> },
            ]}].map(({ u, color, fields }) => (
              <Card key={u?.id}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${color}20`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{u?.username?.[0]?.toUpperCase()}</div>
                  <span style={{ fontWeight: 700 }}>{u?.username}</span>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {fields.map(f => <div key={f.label}><Label>{f.label}</Label>{f.el}</div>)}
                  <button onClick={saveMeasure} disabled={saving}
                    style={{ background: color, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Kaydediliyor...' : 'Ölçüm Kaydet ✓'}
                  </button>
                </div>
              </Card>
            ))}

            {/* Partner measures — sadece görüntü */}
            <Card>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${partnerColor}20`, color: partnerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{partner?.username?.[0]?.toUpperCase()}</div>
                <span style={{ fontWeight: 700 }}>{partner?.username || 'Arkadaşın'}</span>
              </div>
              <div style={{ padding: 20 }}>
                {!partnerMeasures.length ? <div style={{ color: c.muted, fontSize: 13 }}>Henüz ölçüm girilmedi.</div> :
                  partnerMeasures.slice(0, 3).map(m => (
                    <div key={m.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: 12, color: c.muted, marginBottom: 6 }}>{m.date}</div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {m.weight && <span style={{ fontSize: 13, color: partnerColor, fontWeight: 700 }}>{m.weight}kg</span>}
                        {m.waist && <span style={{ fontSize: 13 }}>Bel: {m.waist}cm</span>}
                        {m.hip && <span style={{ fontSize: 13 }}>Kalça: {m.hip}cm</span>}
                        {m.arm && <span style={{ fontSize: 13 }}>Kol: {m.arm}cm</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </>}

        {/* GEÇMİŞ */}
        {activeTab === 'history' && <>
          <div style={{ marginBottom: 20 }}><div style={{ fontWeight: 800, fontSize: 22 }}>Geçmiş Kayıtlar</div></div>
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>{['Tarih', 'Kişi', 'Kalori', 'Protein', 'Su', 'Adım', 'Aktiviteler', 'Yakılan'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: c.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {[...myEntries, ...partnerEntries].sort((a, b) => b.date.localeCompare(a.date)).map(e => {
                    const isMe = e.user_id === user?.id
                    return <tr key={e.id}>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}20` }}>{e.date}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}20` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isMe ? myColor : partnerColor }} />
                          {isMe ? user?.username : partner?.username}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}20` }}>{e.calories || '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}20` }}>{e.protein ? `${e.protein}g` : '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}20` }}>{e.water ? `${e.water}L` : '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}20` }}>{e.steps?.toLocaleString('tr') || '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}20` }}>{e.activities?.length ? e.activities.map((a: any) => a.type).join(', ') : '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}20` }}>{e.total_burned ? `🔥${e.total_burned}` : '—'}</td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>}

        {/* RAPOR */}
        {activeTab === 'report' && <>
          <div style={{ marginBottom: 20 }}><div style={{ fontWeight: 800, fontSize: 22 }}>Rapor</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[{ name: user?.username || '', color: myColor, entries: myEntries, meas: myMeasures },
              { name: partner?.username || 'Arkadaşın', color: partnerColor, entries: partnerEntries, meas: partnerMeasures }].map(({ name, color, entries, meas }) => {
              const avg = (field: string) => { const v = entries.filter((e: any) => e[field]).map((e: any) => e[field]); return v.length ? (v.reduce((a: number, b: number) => a + b, 0) / v.length).toFixed(1) : '—' }
              const latest = meas[0]
              const first = meas[meas.length - 1]
              const weightDiff = latest?.weight && first?.weight ? (latest.weight - first.weight).toFixed(1) : null
              return <Card key={name}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontWeight: 700, color }}>{name}</div>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[['Ort. Kalori', avg('calories'), 'kcal'], ['Ort. Protein', avg('protein'), 'g'], ['Ort. Su', avg('water'), 'L'], ['Ort. Adım', avg('steps'), '']].map(([label, val, unit]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: c.muted }}>{label}</span>
                      <span style={{ fontWeight: 700 }}>{val}{val !== '—' ? unit : ''}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: c.muted, marginBottom: 8 }}>KİLO TAKİBİ</div>
                    {latest?.weight ? <>
                      <div style={{ fontWeight: 800, fontSize: 24, color }}>{latest.weight}kg</div>
                      {weightDiff && <div style={{ fontSize: 13, color: parseFloat(weightDiff) < 0 ? '#6ee7b7' : '#f87171', fontWeight: 700 }}>{parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff}kg</div>}
                    </> : <div style={{ color: c.muted, fontSize: 13 }}>Ölçüm yok</div>}
                  </div>
                  <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: c.muted, marginBottom: 8 }}>AKTİVİTE</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: c.muted }}>Toplam Aktivite Günü</span>
                      <span style={{ fontWeight: 700 }}>{entries.filter(e => e.activities?.length).length} gün</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
                      <span style={{ color: c.muted }}>Toplam Yakılan</span>
                      <span style={{ fontWeight: 700 }}>{entries.reduce((s, e) => s + (e.total_burned || 0), 0)} kcal</span>
                    </div>
                  </div>
                </div>
              </Card>
            })}
          </div>
        </>}

      </div>
    </div>
  )
}