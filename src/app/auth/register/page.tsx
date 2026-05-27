'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister() {
    setLoading(true)
    setError('')

    if (!username.trim()) { setError('Kullanıcı adı gerekli'); setLoading(false); return }
    if (username.length < 3) { setError('Kullanıcı adı en az 3 karakter olmalı'); setLoading(false); return }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: username.trim().toLowerCase(),
        full_name: fullName.trim() || null,
        avatar_color: 'green'
      })
      if (profileError) { setError(profileError.message); setLoading(false); return }
    }

    router.push('/onboarding')
  }

  return (
    <div style={{minHeight:'100vh',background:'#0d0f14',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>
      <div style={{background:'#13161e',border:'1px solid #252a38',borderRadius:16,padding:'40px 48px',width:380,display:'flex',flexDirection:'column',gap:20}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontWeight:800,fontSize:32,letterSpacing:-1}}>
            <span style={{color:'#6ee7b7'}}>Duo</span><span style={{color:'#f472b6'}}>Fit</span>
          </div>
          <div style={{color:'#6b7280',fontSize:13,marginTop:6}}>Hesap oluştur</div>
        </div>

        {error && <div style={{background:'rgba(248,113,113,0.1)',border:'1px solid #f87171',borderRadius:10,padding:'10px 14px',color:'#f87171',fontSize:13}}>{error}</div>}

        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <label style={{fontSize:11,color:'#6b7280',letterSpacing:0.5,textTransform:'uppercase'}}>İsim Soyisim</label>
          <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Ali Yılmaz"
            style={{background:'#1a1e29',border:'1px solid #252a38',color:'#e8eaf0',borderRadius:10,padding:'10px 14px',fontSize:14,outline:'none'}} />
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <label style={{fontSize:11,color:'#6b7280',letterSpacing:0.5,textTransform:'uppercase'}}>Kullanıcı Adı</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="aliyilmaz"
            style={{background:'#1a1e29',border:'1px solid #252a38',color:'#e8eaf0',borderRadius:10,padding:'10px 14px',fontSize:14,outline:'none'}} />
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <label style={{fontSize:11,color:'#6b7280',letterSpacing:0.5,textTransform:'uppercase'}}>E-posta</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="sen@example.com"
            style={{background:'#1a1e29',border:'1px solid #252a38',color:'#e8eaf0',borderRadius:10,padding:'10px 14px',fontSize:14,outline:'none'}} />
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <label style={{fontSize:11,color:'#6b7280',letterSpacing:0.5,textTransform:'uppercase'}}>Şifre</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="En az 6 karakter"
            onKeyDown={e=>e.key==='Enter'&&handleRegister()}
            style={{background:'#1a1e29',border:'1px solid #252a38',color:'#e8eaf0',borderRadius:10,padding:'10px 14px',fontSize:14,outline:'none'}} />
        </div>

        <button onClick={handleRegister} disabled={loading}
          style={{background:'#6ee7b7',color:'#0d0f14',border:'none',borderRadius:10,padding:'12px',fontWeight:700,fontSize:14,cursor:'pointer',opacity:loading?0.6:1}}>
          {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
        </button>

        <div style={{textAlign:'center',fontSize:13,color:'#6b7280'}}>
          Zaten hesabın var mı?{' '}
          <Link href="/auth/login" style={{color:'#6ee7b7',textDecoration:'none',fontWeight:600}}>Giriş yap</Link>
        </div>
      </div>
    </div>
  )
}