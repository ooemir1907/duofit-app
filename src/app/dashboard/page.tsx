'use client'

import { isConsecutiveDay, getCurrentMonth, getRandomQuestions } from '@/lib/streak'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Duo, DailyEntry, Measurement, Comment, User } from '@/lib/types'


const inputStyle = {
  background: '#1a1e29', border: '1px solid #252a38', color: '#e8eaf0',
  borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none'
}

function Card({ children, style }: any) {
  return <div style={{ background: '#13161e', border: '1px solid #252a38', borderRadius: 16, overflow: 'hidden', ...style }}>{children}</div>
}

function Label({ children }: any) {
  return <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 }}>{children}</div>
}

function Input({ value, onChange, ...props }: any) {
  return <input value={value} onChange={e => onChange(e.target.value)} style={inputStyle} {...props} />
}

function SectionTitle({ children }: any) {
  return <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, fontWeight: 700, borderTop: '1px solid #252a38', paddingTop: 12, marginTop: 4 }}>{children}</div>
}


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
  const [todayMeals, setTodayMeals] = useState<{id:string,description:string,calories:number,protein:number,carbs:number,fat:number}[]>([])
  const [showWeeklyWrap, setShowWeeklyWrap] = useState(false)

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

  // AI form state

  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<{calories:number,protein:number,carbs:number,fat:number,summary:string} | null>(null)
  const [aiError, setAiError] = useState('')

  const [streakBroken, setStreakBroken] = useState<{canRescue: boolean, missedDate: string, oldStreak: number} | null>(null)

  // Goals state
  const [myGoals, setMyGoals] = useState({ calories: 0, protein: 0, water: 0, steps: 0 })

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

useEffect(() => {
  const el = document.getElementById('chatMessages')
  if (el) el.scrollTop = el.scrollHeight
}, [comments])

useEffect(() => {
  if (todayMeals.length > 0) {
    setCal(todayMeals.reduce((s,m)=>s+m.calories,0).toString())
    setProtein(todayMeals.reduce((s,m)=>s+m.protein,0).toString())
  }
}, [todayMeals])

  async function loadAll() {
    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.push('/auth/login'); return }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
    if (!profile) { router.push('/auth/login'); return }
    setUser(profile)

// Streak kırılma kontrolü
if (profile.last_active_date) {
  const lastDate = new Date(profile.last_active_date)
  const todayDate = new Date(today())
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000)
  
  if (diffDays >= 2 && profile.current_streak > 0) {
    // Streak kırıldı, kurtarma hakkı var mı kontrol et
    const month = getCurrentMonth()
    const rescuesUsed = profile.rescues_month === month ? (profile.rescues_used_this_month || 0) : 0
    setStreakBroken({ canRescue: rescuesUsed < 2, missedDate: profile.last_active_date, oldStreak: profile.current_streak })
  }
}

    setMyGoals({
        calories: profile.calorie_goal || 0,
        protein: profile.protein_goal || 0,
        water: profile.water_goal || 0,
        steps: profile.step_goal || 0,
    })

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

      const { data: meals } = await supabase.from('meal_entries').select('*').eq('user_id', authUser.id).eq('duo_id', duoData.id).eq('date', today())
      setTodayMeals(meals || [])

      const { data: myM } = await supabase.from('measurements').select('*').eq('user_id', authUser.id).eq('duo_id', duoData.id).order('date', { ascending: false })
      const { data: partM } = await supabase.from('measurements').select('*').eq('user_id', partnerId).eq('duo_id', duoData.id).order('date', { ascending: false })
      setMyMeasures(myM || [])
      setPartnerMeasures(partM || [])

      const { data: comm } = await supabase.from('comments').select('*, author:profiles(*)').eq('duo_id', duoData.id).order('created_at', { ascending: true }).limit(20)
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
      calories: parseInt(cal) || null, calories_goal: myGoals.calories || null,
      protein: parseFloat(protein) || null, protein_goal: myGoals.protein || null,
      water: parseFloat(water) || null, steps: parseInt(steps) || null,
      activities: acts, total_burned: totalBurned || null, total_workout: totalWorkout || null
    }
    await supabase.from('daily_entries').upsert(entry, { onConflict: 'user_id,date' })
    setSaving(false)

// Streak güncelle
if (entryDate === today() && user) {
  const status = isConsecutiveDay(user.last_active_date, today())
  let newStreak = user.current_streak || 0
  if (status === 'continue') newStreak += 1
  else if (status === 'broken') newStreak = 1
  // 'same' ise değişmez, zaten bugün girilmiş

  if (status !== 'same') {
    await supabase.from('profiles').update({
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, user.longest_streak || 0),
      last_active_date: today()
    }).eq('id', user.id)
  }
}

    loadAll()
    setActiveTab('dashboard')
  }

  async function calculateMeal() {
  if (!aiInput.trim()) return
  setAiLoading(true)
  setAiError('')
  setAiResult(null)
  try {
    const res = await fetch('/api/calculate-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: aiInput })
    })
    const data = await res.json()
    if (!res.ok) {
      setAiError(data.error || 'Bir hata oluştu')
      setAiLoading(false)
      return
    }
    setAiResult(data)
  } catch (e) {
    setAiError('Bağlantı hatası')
  }
  setAiLoading(false)
}

async function applyAiResult() {
  if (!aiResult || !user || !duo) return
  await supabase.from('meal_entries').insert({
    user_id: user.id,
    duo_id: duo.id,
    date: today(),
    description: aiInput,
    calories: aiResult.calories,
    protein: aiResult.protein,
    carbs: aiResult.carbs,
    fat: aiResult.fat,
  })
  setAiResult(null)
  setAiInput('')
  loadAll()
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
      {streakBroken && (
  <StreakRescueModal 
    streakBroken={streakBroken}
    onClose={() => setStreakBroken(null)}
    onRescued={() => { setStreakBroken(null); loadAll() }}
    user={user}
    duo={duo}
    supabase={supabase}
  />
)}

{showWeeklyWrap && (
  <WeeklyWrapModal
    onClose={() => setShowWeeklyWrap(false)}
    user={user}
    partner={partner}
    myEntries={myEntries}
    partnerEntries={partnerEntries}
    myMeasures={myMeasures}
    partnerMeasures={partnerMeasures}
    myColor={myColor}
    partnerColor={partnerColor}
  />
)}
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
          <button onClick={() => router.push('/settings')}
            style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.muted, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            ⚙️ Ayarlar    
            </button>
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

          <div onClick={() => setShowWeeklyWrap(true)} style={{ background: `linear-gradient(135deg, ${myColor}15, ${partnerColor}15)`, border: `1px solid ${c.border}`, borderRadius: 16, padding: 20, marginBottom: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s'}}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>📊 Haftalık Özetin Hazır</div>
              <div style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Bu hafta neler yaptın, gör</div>
              </div>
              <div style={{ fontSize: 24 }}>→</div>
              </div>

          {/* YORUMLAR */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}`, fontWeight: 700 }}>💬 Duo Sohbeti</div>
            <div 
              id="chatMessages"
              style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
              {comments.length === 0 && <div style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>Henüz mesaj yok. İlk sen yaz!</div>}
              {comments.map(comm => (
                <div key={comm.id} style={{ display: 'flex', gap: 10, flexDirection: (comm as any).author?.id === user?.id ? 'row-reverse' : 'row' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: (comm as any).author?.id === user?.id ? `${myColor}20` : `${partnerColor}20`, color: (comm as any).author?.id === user?.id ? myColor : partnerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                    {(comm as any).author?.username?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ background: c.surface2, borderRadius: 12, padding: '8px 14px', maxWidth: '70%' }}>
                    <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{comm.content}</div>
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

              <div style={{ background: `${myColor}10`, border: `1px solid ${myColor}30`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
  <div style={{ fontSize: 13, fontWeight: 700, color: myColor, display: 'flex', alignItems: 'center', gap: 6 }}>
    ✨ AI ile Kalori Hesapla
  </div>
  <textarea
    value={aiInput}
    onChange={e => setAiInput(e.target.value)}
    placeholder="Ne yedin? Örn: 1 tabak makarna, 2 yumurta, yarım ekmek"
    rows={2}
    maxLength={500}
    style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
  />
  <button onClick={calculateMeal} disabled={aiLoading || !aiInput.trim()}
    style={{ background: myColor, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
    {aiLoading ? 'Hesaplanıyor...' : '🧮 Hesapla'}
  </button>

  {aiError && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171', borderRadius: 8, padding: 10, color: '#f87171', fontSize: 12 }}>{aiError}</div>}

  {aiResult && (
    <div style={{ background: c.surface2, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: c.muted }}>{aiResult.summary}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ fontSize: 13 }}>🔥 <strong>{aiResult.calories}</strong> kcal</div>
        <div style={{ fontSize: 13 }}>💪 <strong>{aiResult.protein}</strong>g protein</div>
        <div style={{ fontSize: 13 }}>🍞 <strong>{aiResult.carbs}</strong>g karbonhidrat</div>
        <div style={{ fontSize: 13 }}>🥑 <strong>{aiResult.fat}</strong>g yağ</div>
      </div>
      <button onClick={applyAiResult}
        style={{ background: myColor, color: '#0d0f14', border: 'none', borderRadius: 8, padding: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
        ✓ Veri Girişine Ekle
      </button>
    </div>
  )}

{todayMeals.length > 0 && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
    <div style={{ fontSize: 12, color: c.muted, fontWeight: 700 }}>BUGÜN EKLENEN YEMEKLER ({todayMeals.length})</div>
    {todayMeals.map(meal => (
      <div key={meal.id} style={{ background: c.surface2, borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 12, flex: 1 }}>{meal.description} <span style={{ color: c.muted }}>· {meal.calories}kcal · {meal.protein}g</span></div>
        <button onClick={async () => { await supabase.from('meal_entries').delete().eq('id', meal.id); loadAll() }}
          style={{ background: 'none', border: 'none', color: c.muted, cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>
    ))}
    <div style={{ background: `${myColor}15`, borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
      <span>Toplam</span>
      <span>{todayMeals.reduce((s,m)=>s+m.calories,0)} kcal · {todayMeals.reduce((s,m)=>s+m.protein,0)}g protein</span>
    </div>
  </div>
)}

</div>

              <SectionTitle>🥗 Beslenme</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Label>Kalori (kcal)</Label><input type="number" value={cal} onChange={e => setCal(e.target.value)} placeholder="2000"
                    style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }} />
                </div>
                <div>
                    <Label>Kalori Hedef</Label>
                    <div style={{ background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: myGoals.calories ? c.text : c.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{myGoals.calories ? `${myGoals.calories} kcal` : 'Ayarlardan belirle'}</span>
                        {!myGoals.calories && <button onClick={() => router.push('/settings')} style={{ background: 'none', border: 'none', color: '#6ee7b7', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Ayarla →</button>}
                    </div>
                </div>
                    
                <div><Label>Protein (g)</Label><input type="number" value={protein} onChange={e => setProtein(e.target.value)} placeholder="150"
                    style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }} />
                </div>
                <div>
                    <Label>Protein Hedef (g)</Label>
                    <div style={{ background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: myGoals.protein ? c.text : c.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{myGoals.protein ? `${myGoals.protein}g` : 'Ayarlardan belirle'}</span>
                        {!myGoals.protein && <button onClick={() => router.push('/settings')} style={{ background: 'none', border: 'none', color: '#6ee7b7', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Ayarla →</button>}
                    </div>
                </div>

              </div>
              <div>
                <Label>Su Hedefi</Label>
                <div
                    onClick={() => setWater(water === 'true' ? '' : 'true')}
                    style={{ background: water === 'true' ? '#6ee7b720' : c.surface2, border: `2px solid ${water === 'true' ? '#6ee7b7' : c.border}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: water === 'true' ? '#6ee7b7' : c.surface, border: `2px solid ${water === 'true' ? '#6ee7b7' : c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                        {water === 'true' && <span style={{ color: '#0d0f14', fontSize: 14, fontWeight: 800 }}>✓</span>}  
                    </div>
                    <span style={{ fontSize: 14, color: water === 'true' ? c.text : c.muted }}>
                        {myGoals.water ? `Günlük ${myGoals.water}L su içildi` : 'Su hedefi içildi'}
                    </span>
                </div>
               </div>
            

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
              <div>
                <Label>Adım Sayısı</Label>
                <input type="number" value={steps} onChange={e => setSteps(e.target.value)}
                    placeholder={myGoals.steps ? `Hedef: ${myGoals.steps}` : "8000"}
                    style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }} />
              </div>

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

function StreakRescueModal({ streakBroken, onClose, onRescued, user, duo, supabase }: any) {
  const [step, setStep] = useState<'ask' | 'questions' | 'success' | 'waiting' | 'denied'>('ask')
  const [questions] = useState(() => getRandomQuestions())
  const [answers, setAnswers] = useState<string[]>(['', ''])
  const [customAnswer, setCustomAnswer] = useState<{[key: number]: string}>({})
  const [submitting, setSubmitting] = useState(false)

  const c = { surface: '#13161e', surface2: '#1a1e29', border: '#252a38', a: '#6ee7b7', b: '#f472b6', text: '#e8eaf0', muted: '#6b7280', danger: '#f87171', gold: '#fbbf24' }

  function startRescue() {
    if (!streakBroken.canRescue) { setStep('denied'); return }
    setStep('questions')
  }

  function selectOption(qIndex: number, option: string) {
    const n = [...answers]
    n[qIndex] = option === 'Diğer' ? (customAnswer[qIndex] || '') : option
    setAnswers(n)
  }

  async function submitAnswers() {
    if (answers.some(a => !a.trim())) return
    setSubmitting(true)

    const month = getCurrentMonth()
    const rescuesUsed = user.rescues_month === month ? (user.rescues_used_this_month || 0) : 0
    const autoApprove = rescuesUsed < 2

    await supabase.from('streak_rescues').insert({
      user_id: user.id,
      duo_id: duo.id,
      missed_date: streakBroken.missedDate,
      status: autoApprove ? 'approved' : 'pending',
      questions: questions.map((q: any) => q.question),
      answers
    })

    await supabase.from('profiles').update({
      rescues_used_this_month: rescuesUsed + 1,
      rescues_month: month,
      ...(autoApprove ? { current_streak: streakBroken.oldStreak, last_active_date: new Date().toISOString().split('T')[0] } : {})
    }).eq('id', user.id)

    setSubmitting(false)
    setStep(autoApprove ? 'success' : 'waiting')
  }

  async function giveUp() {
    await supabase.from('profiles').update({
      current_streak: 0,
      last_active_date: null
    }).eq('id', user.id)
    onRescued()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, padding: 32, width: 440, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {step === 'ask' && <>
          <div style={{ textAlign: 'center', fontSize: 40 }}>💔</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>Streak'in Kırıldı</div>
            <div style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>
              {streakBroken.oldStreak} günlük serin sona erdi. Kurtarmak ister misin?
            </div>
          </div>
          {streakBroken.canRescue ? (
            <>
              <div style={{ background: `${c.gold}15`, border: `1px solid ${c.gold}40`, borderRadius: 10, padding: 12, fontSize: 12, color: c.text }}>
                Bu ay kalan kurtarma hakkın var. Birkaç soruyu cevapla, streak'in geri gelsin.
              </div>
              <button onClick={startRescue} style={{ background: c.a, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
                Evet, Kurtarmak İstiyorum
              </button>
            </>
          ) : (
            <div style={{ background: `${c.danger}15`, border: `1px solid ${c.danger}40`, borderRadius: 10, padding: 12, fontSize: 12, color: c.text }}>
              Bu ay otomatik kurtarma hakkın bitti. Şimdi duonun onayı gerekiyor.
            </div>
          )}
          {!streakBroken.canRescue && (
            <button onClick={startRescue} style={{ background: c.b, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
              Duona Sor
            </button>
          )}
          <button onClick={giveUp} style={{ background: 'none', border: `1px solid ${c.border}`, color: c.muted, borderRadius: 10, padding: 10, cursor: 'pointer', fontSize: 13 }}>
            Boşver, Yeniden Başlarım
          </button>
        </>}

        {step === 'questions' && <>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Birkaç Soru</div>
          <div style={{ color: c.muted, fontSize: 12 }}>Hızlıca seç, devam edelim</div>
          {questions.map((q: any, i: number) => (
            <div key={i}>
              <div style={{ fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{q.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt: string) => (
                  <button
                    key={opt}
                    onClick={() => selectOption(i, opt)}
                    style={{
                      background: answers[i] === opt || (opt === 'Diğer' && answers[i] && !q.options.slice(0,-1).includes(answers[i])) ? `${c.a}20` : c.surface2,
                      border: `1px solid ${answers[i] === opt || (opt === 'Diğer' && answers[i] && !q.options.slice(0,-1).includes(answers[i])) ? c.a : c.border}`,
                      color: c.text, borderRadius: 8, padding: '10px 14px', fontSize: 13, textAlign: 'left', cursor: 'pointer'
                    }}>
                    {opt}
                  </button>
                ))}
                {q.options.includes('Diğer') && !q.options.slice(0,-1).includes(answers[i]) === false ? null : null}
              </div>
              {(answers[i] !== '' && !q.options.slice(0, -1).includes(answers[i])) || (customAnswer[i] !== undefined) ? (
                <input
                  value={customAnswer[i] || ''}
                  onChange={e => { setCustomAnswer({...customAnswer, [i]: e.target.value}); const n = [...answers]; n[i] = e.target.value; setAnswers(n) }}
                  placeholder="Yazabilirsin..."
                  style={{ marginTop: 8, background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', outline: 'none' }}
                />
              ) : null}
            </div>
          ))}
          <button onClick={submitAnswers} disabled={submitting || answers.some(a => !a.trim())}
            style={{ background: c.a, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Gönderiliyor...' : 'Gönder'}
          </button>
        </>}

        {step === 'success' && <>
          <div style={{ textAlign: 'center', fontSize: 40 }}>🎉</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Streak'in Geri Geldi!</div>
            <div style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>
              {streakBroken.oldStreak} günlük serin korundu. Devam et! 💪
            </div>
          </div>
          <button onClick={onRescued} style={{ background: c.a, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
            Harika!
          </button>
        </>}

        {step === 'waiting' && <>
          <div style={{ textAlign: 'center', fontSize: 40 }}>⏳</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Duona Gönderildi</div>
            <div style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>
              Cevapların duonun onayına gönderildi. Dashboard'da bildirim göreceksin.
            </div>
          </div>
          <button onClick={onClose} style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: 12, cursor: 'pointer' }}>
            Anladım
          </button>
        </>}

        {step === 'denied' && <>
          <div style={{ textAlign: 'center', fontSize: 40 }}>🚫</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Hak Kalmadı</div>
            <div style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>
              Bu ay 2 kurtarma hakkını kullandın. Önümüzdeki ay tekrar hakkın olacak.
            </div>
          </div>
          <button onClick={giveUp} style={{ background: c.a, color: '#0d0f14', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
            Tamam, Devam Ediyorum
          </button>
        </>}

      </div>
    </div>
  )
}

function WeeklyWrapModal({ onClose, user, partner, myEntries, partnerEntries, myMeasures, partnerMeasures, myColor, partnerColor }: any) {
  const [cardIndex, setCardIndex] = useState(0)
  const c = { surface: '#13161e', surface2: '#1a1e29', border: '#252a38', a: '#6ee7b7', b: '#f472b6', text: '#e8eaf0', muted: '#6b7280', gold: '#fbbf24' }

  const weekAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0] })()
  const myWeek = myEntries.filter((e: any) => e.date >= weekAgo)
  const partnerWeek = partnerEntries.filter((e: any) => e.date >= weekAgo)

  const myAvgCal = myWeek.length ? Math.round(myWeek.reduce((s: number, e: any) => s + (e.calories || 0), 0) / myWeek.length) : 0
  const partnerAvgCal = partnerWeek.length ? Math.round(partnerWeek.reduce((s: number, e: any) => s + (e.calories || 0), 0) / partnerWeek.length) : 0
  const myActiveDays = myWeek.filter((e: any) => e.activities?.length).length
  const partnerActiveDays = partnerWeek.filter((e: any) => e.activities?.length).length
  const myTotalSteps = myWeek.reduce((s: number, e: any) => s + (e.steps || 0), 0)
  const partnerTotalSteps = partnerWeek.reduce((s: number, e: any) => s + (e.steps || 0), 0)
  const myDaysLogged = myWeek.length
  const partnerDaysLogged = partnerWeek.length

  const myWeekMeasures = myMeasures.filter((m: any) => m.date >= weekAgo)
  const myWeightChange = myWeekMeasures.length >= 2 ? (myWeekMeasures[0].weight - myWeekMeasures[myWeekMeasures.length-1].weight).toFixed(1) : null

  const winner = myActiveDays > partnerActiveDays ? user?.username : partnerActiveDays > myActiveDays ? partner?.username : null

  const cards = [
    <div key="0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>✨</div>
      <div style={{ fontWeight: 800, fontSize: 24 }}>Bu Haftan Hazır</div>
      <div style={{ color: c.muted, fontSize: 14 }}>{user?.username} & {partner?.username}</div>
    </div>,
    <div key="1" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center', fontSize: 14, color: c.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>VERİ GİRİŞİ</div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: myColor }}>{myDaysLogged}</div>
          <div style={{ fontSize: 12, color: c.muted }}>{user?.username}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: partnerColor }}>{partnerDaysLogged}</div>
          <div style={{ fontSize: 12, color: c.muted }}>{partner?.username}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: c.muted }}>/ 7 gün veri girdiniz</div>
    </div>,
    <div key="2" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center', fontSize: 14, color: c.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>AKTİVİTE GÜNLERİ</div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: myColor }}>{myActiveDays}</div>
          <div style={{ fontSize: 12, color: c.muted }}>{user?.username}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: partnerColor }}>{partnerActiveDays}</div>
          <div style={{ fontSize: 12, color: c.muted }}>{partner?.username}</div>
        </div>
      </div>
      {winner && <div style={{ textAlign: 'center', fontSize: 13, color: c.gold, fontWeight: 700 }}>🏆 {winner} bu hafta önde!</div>}
    </div>,
    <div key="3" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center', fontSize: 14, color: c.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>TOPLAM ADIM</div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: myColor }}>{myTotalSteps.toLocaleString('tr')}</div>
          <div style={{ fontSize: 12, color: c.muted }}>{user?.username}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: partnerColor }}>{partnerTotalSteps.toLocaleString('tr')}</div>
          <div style={{ fontSize: 12, color: c.muted }}>{partner?.username}</div>
        </div>
      </div>
    </div>,
    <div key="4" style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: c.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>KİLO DURUMU</div>
      {myWeightChange !== null ? (
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, color: parseFloat(myWeightChange) < 0 ? c.a : '#f87171' }}>
            {parseFloat(myWeightChange) > 0 ? '+' : ''}{myWeightChange}kg
          </div>
          <div style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>
            {parseFloat(myWeightChange) < 0 ? 'Harika gidiyorsun! 💪' : 'Devam et, sen yaparsın 🔥'}
          </div>
        </div>
      ) : (
        <div style={{ color: c.muted, fontSize: 13 }}>Bu hafta ölçüm girilmedi</div>
      )}
    </div>,
    <div key="5" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>🎯</div>
      <div style={{ fontWeight: 800, fontSize: 20 }}>Yeni Haftaya Hazır mısın?</div>
      <div style={{ color: c.muted, fontSize: 13 }}>Birbirinizi motive edin, devam edin!</div>
    </div>,
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: `linear-gradient(135deg, ${c.surface}, ${c.surface2})`, border: `1px solid ${c.border}`, borderRadius: 20, padding: 36, width: 380, minHeight: 380, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: c.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cards[cardIndex]}
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 24 }}>
          {cards.map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === cardIndex ? c.a : c.border }} />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button onClick={() => setCardIndex(Math.max(0, cardIndex - 1))} disabled={cardIndex === 0}
            style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: '10px 16px', cursor: 'pointer', opacity: cardIndex === 0 ? 0.3 : 1 }}>
            ← Önceki
          </button>
          {cardIndex < cards.length - 1 ? (
            <button onClick={() => setCardIndex(cardIndex + 1)}
              style={{ background: c.a, color: '#0d0f14', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>
              Sonraki →
            </button>
          ) : (
            <button onClick={onClose}
              style={{ background: c.a, color: '#0d0f14', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>
              Tamam ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}