'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Kullanıcı adı en az 3 karakter olmalı'
  if (username.length > 10) return 'Kullanıcı adı en fazla 10 karakter olmalı'
  if (!/^[a-zA-ZçÇğĞıİöÖşŞüÜ0-9]+$/.test(username)) return 'Kullanıcı adı sadece harf ve rakam içerebilir'
  return null
}

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
    setError('')

    // Önce tüm validasyonları yap, Supabase'e gitme
    if (!fullName.trim()) { setError('İsim gerekli'); return }
    if (!username.trim()) { setError('Kullanıcı adı gerekli'); return }

    const usernameError = validateUsername(username.trim())
    if (usernameError) { setError(usernameError); return }

    if (!email.trim()) { setError('E-posta gerekli'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Geçerli bir e-posta gir'); return }
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı'); return }

    setLoading(true)

    // Kullanıcı adı başkası tarafından alınmış mı?
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      setError('Bu kullanıcı adı zaten alınmış')
      setLoading(false)
      return
    }

    // Supabase auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('Bu e-posta zaten kayıtlı')
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: username.trim().toLowerCase(),
        full_name: fullName.trim(),
        avatar_color: 'green'
      })
      if (profileError) {
        // Profil oluşturulamadıysa auth kullanıcısını da sil
        await supabase.auth.signOut()
        setError('Profil oluşturulamadı, tekrar dene')
        setLoading(false)
        return
      }
    }

    router.push('/onboarding')
  }

  const inputStyle = {
    background: '#1a1e29', border: '1px solid #252a38', color: '#e8eaf0',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', width: '100%'
  }
  const labelStyle = {
    fontSize: 11, color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 6, display: 'block'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#13161e', border: '1px solid #252a38', borderRadius: 16, padding: '40px 48px', width: 380, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: -1 }}>
            <span style={{ color: '#6ee7b7' }}>Duo</span><span style={{ color: '#f472b6' }}>Fit</span>
          </div>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Hesap oluştur</div>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171', borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div><label style={labelStyle}>İsim Soyisim</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ali Yılmaz" style={inputStyle} /></div>

        <div>
          <label style={labelStyle}>Kullanıcı Adı <span style={{ color: '#6b7280', fontWeight: 400 }}>(max 10 karakter)</span></label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="aliyilmaz" maxLength={10} style={inputStyle} />
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Harf, rakam, Türkçe karakter kullanabilirsin</div>
        </div>

        <div><label style={labelStyle}>E-posta</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sen@example.com" style={inputStyle} /></div>

        <div><label style={labelStyle}>Şifre <span style={{ color: '#6b7280', fontWeight: 400 }}>(en az 6 karakter)</span></label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleRegister()} style={inputStyle} /></div>

        <button onClick={handleRegister} disabled={loading}
          style={{ background: '#6ee7b7', color: '#0d0f14', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          Zaten hesabın var mı?{' '}
          <Link href="/auth/login" style={{ color: '#6ee7b7', textDecoration: 'none', fontWeight: 600 }}>Giriş yap</Link>
        </div>
      </div>
    </div>
  )
}