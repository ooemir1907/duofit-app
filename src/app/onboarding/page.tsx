'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function OnboardingPage() {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [inviteCode, setInviteCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUserId(data.user.id)
      // Zaten duo varsa dashboard'a git
      supabase.from('duos')
        .select('id')
        .or(`user_a.eq.${data.user.id},user_b.eq.${data.user.id}`)
        .eq('status', 'active')
        .single()
        .then(({ data: duo }) => { if (duo) router.push('/dashboard') })
    })
  }, [])

  async function handleCreate() {
    if (!userId) return
    setLoading(true)
    setError('')
    const code = generateInviteCode()
    const { error } = await supabase.from('duos').insert({
      user_a: userId,
      invite_code: code,
      status: 'pending'
    })
    if (error) { setError(error.message); setLoading(false); return }
    setInviteCode(code)
    setMode('create')
    setLoading(false)
  }

  async function handleJoin() {
    if (!userId) return
    setLoading(true)
    setError('')
    const { data: duo, error: findError } = await supabase
      .from('duos')
      .select('*')
      .eq('invite_code', joinCode.toUpperCase().trim())
      .eq('status', 'pending')
      .single()

    if (findError || !duo) {
      setError('Kod bulunamadı veya zaten kullanılmış')
      setLoading(false)
      return
    }
    if (duo.user_a === userId) {
      setError('Kendi koduna katamazsın')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('duos')
      .update({ user_b: userId, status: 'active' })
      .eq('id', duo.id)

    if (updateError) { setError(updateError.message); setLoading(false); return }
    router.push('/dashboard')
  }

  const s = {
    page: {minHeight:'100vh',background:'#0d0f14',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'} as React.CSSProperties,
    card: {background:'#13161e',border:'1px solid #252a38',borderRadius:16,padding:'40px 48px',width:400,display:'flex',flexDirection:'column',gap:24} as React.CSSProperties,
    logo: {textAlign:'center',fontWeight:800,fontSize:32,letterSpacing:-1} as React.CSSProperties,
    subtitle: {textAlign:'center',color:'#6b7280',fontSize:13,marginTop:6} as React.CSSProperties,
    btn: (color='#6ee7b7') => ({background:color,color:'#0d0f14',border:'none',borderRadius:10,padding:'14px',fontWeight:700,fontSize:14,cursor:'pointer',width:'100%'}) as React.CSSProperties,
    outlineBtn: {background:'none',border:'1px solid #252a38',color:'#e8eaf0',borderRadius:10,padding:'14px',fontWeight:600,fontSize:14,cursor:'pointer',width:'100%'} as React.CSSProperties,
    input: {background:'#1a1e29',border:'1px solid #252a38',color:'#e8eaf0',borderRadius:10,padding:'12px 14px',outline:'none',width:'100%',textAlign:'center',letterSpacing:4,fontSize:20,fontWeight:700} as React.CSSProperties,
    error: {background:'rgba(248,113,113,0.1)',border:'1px solid #f87171',borderRadius:10,padding:'10px 14px',color:'#f87171',fontSize:13} as React.CSSProperties,
    codeBox: {background:'#1a1e29',border:'2px solid #6ee7b7',borderRadius:12,padding:'20px',textAlign:'center'} as React.CSSProperties,
  }

  if (mode === 'choose') return (
    <div style={s.page}>
      <div style={s.card}>
        <div>
          <div style={s.logo}><span style={{color:'#6ee7b7'}}>Duo</span><span style={{color:'#f472b6'}}>Fit</span></div>
          <div style={s.subtitle}>Duo'nu kur ve başla</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{color:'#6b7280',fontSize:12,textAlign:'center',textTransform:'uppercase',letterSpacing:0.5}}>Ne yapmak istiyorsun?</div>
          <button style={s.btn()} onClick={handleCreate} disabled={loading}>
            {loading ? 'Oluşturuluyor...' : '✨ Yeni Duo Oluştur'}
          </button>
          <button style={s.outlineBtn} onClick={() => setMode('join')}>
            🔗 Davet Koduna Katıl
          </button>
        </div>
        {error && <div style={s.error}>{error}</div>}
      </div>
    </div>
  )

  if (mode === 'create') return (
    <div style={s.page}>
      <div style={s.card}>
        <div>
          <div style={s.logo}><span style={{color:'#6ee7b7'}}>Duo</span><span style={{color:'#f472b6'}}>Fit</span></div>
          <div style={s.subtitle}>Duo'n oluşturuldu!</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{color:'#e8eaf0',fontSize:14,textAlign:'center'}}>
            Bu kodu arkadaşına gönder:
          </div>
          <div style={s.codeBox}>
            <div style={{color:'#6ee7b7',fontFamily:'monospace',fontSize:36,fontWeight:800,letterSpacing:8}}>{inviteCode}</div>
          </div>
          <div style={{color:'#6b7280',fontSize:12,textAlign:'center'}}>
            Arkadaşın bu kodu girdiğinde duo'nuz aktif olacak
          </div>
          <button style={s.btn()} onClick={() => {navigator.clipboard.writeText(inviteCode); alert('Kod kopyalandı!')}}>
            📋 Kodu Kopyala
          </button>
          <button style={s.outlineBtn} onClick={() => router.push('/dashboard')}>
            Dashboard'a Git →
          </button>
        </div>
      </div>
    </div>
  )

  if (mode === 'join') return (
    <div style={s.page}>
      <div style={s.card}>
        <div>
          <div style={s.logo}><span style={{color:'#6ee7b7'}}>Duo</span><span style={{color:'#f472b6'}}>Fit</span></div>
          <div style={s.subtitle}>Duo'ya katıl</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{color:'#e8eaf0',fontSize:14,textAlign:'center'}}>Arkadaşının davet kodunu gir:</div>
          <input
            style={s.input}
            placeholder="ABC123"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          {error && <div style={s.error}>{error}</div>}
          <button style={s.btn('#f472b6')} onClick={handleJoin} disabled={loading || joinCode.length < 6}>
            {loading ? 'Katılınıyor...' : '🔗 Duo\'ya Katıl'}
          </button>
          <button style={s.outlineBtn} onClick={() => setMode('choose')}>← Geri</button>
        </div>
      </div>
    </div>
  )
}