'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const [calorieGoal, setCalorieGoal] = useState('')
  const [proteinGoal, setProteinGoal] = useState('')
  const [waterGoal, setWaterGoal] = useState('')
  const [stepGoal, setStepGoal] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) {
        setCalorieGoal(profile.calorie_goal?.toString() || '')
        setProteinGoal(profile.protein_goal?.toString() || '')
        setWaterGoal(profile.water_goal?.toString() || '')
        setStepGoal(profile.step_goal?.toString() || '')
        setUsername(profile.username || '')
        setFullName(profile.full_name || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({
      calorie_goal: parseInt(calorieGoal) || null,
      protein_goal: parseInt(proteinGoal) || null,
      water_goal: parseFloat(waterGoal) || null,
      step_goal: parseInt(stepGoal) || null,
      full_name: fullName.trim() || null,
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const c = { bg: '#0d0f14', surface: '#13161e', surface2: '#1a1e29', border: '#252a38', a: '#6ee7b7', text: '#e8eaf0', muted: '#6b7280' }
  const inputStyle = { background: c.surface2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }
  const labelStyle = { fontSize: 11, color: c.muted, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontFamily: 'sans-serif' }}>
      Yükleniyor...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: 'sans-serif', color: c.text }}>
      {/* NAV */}
      <nav style={{ background: c.surface, borderBottom: `1px solid ${c.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}><span style={{ color: c.a }}>Duo</span><span style={{ color: '#f472b6' }}>Fit</span></div>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: c.surface2, border: `1px solid ${c.border}`, color: c.muted, borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>
          ← Dashboard
        </button>
      </nav>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 24 }}>Ayarlar</div>
          <div style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>Hedeflerini bir kez gir, her gün otomatik dolar</div>
        </div>

        {/* PROFİL */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${c.border}`, fontWeight: 700, fontSize: 14 }}>👤 Profil</div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>İsim Soyisim</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Kullanıcı Adı</label>
              <input value={username} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
              <div style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>Kullanıcı adı değiştirilemez</div>
            </div>
          </div>
        </div>

        {/* GÜNLÜK HEDEFLER */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${c.border}`, fontWeight: 700, fontSize: 14 }}>🎯 Günlük Hedefler</div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ background: c.surface2, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: c.muted, lineHeight: 1.6 }}>
              💡 Bu hedefler veri giriş ekranında otomatik olarak dolar. Her gün tekrar girmene gerek yok.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Günlük Kalori (kcal)</label>
                <input type="number" value={calorieGoal} onChange={e => setCalorieGoal(e.target.value)} placeholder="2000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Günlük Protein (g)</label>
                <input type="number" value={proteinGoal} onChange={e => setProteinGoal(e.target.value)} placeholder="150" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Günlük Su (litre)</label>
                <input type="number" value={waterGoal} onChange={e => setWaterGoal(e.target.value)} placeholder="2.5" step="0.1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Günlük Adım</label>
                <input type="number" value={stepGoal} onChange={e => setStepGoal(e.target.value)} placeholder="8000" style={inputStyle} />
              </div>
            </div>

            {/* Kalori hesaplama ipucu */}
            <div style={{ background: `${c.a}10`, border: `1px solid ${c.a}30`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: c.text, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: c.a, marginBottom: 6 }}>Hedefini nasıl belirlersin?</div>
              <div style={{ color: c.muted }}>
                Kilo vermek istiyorsan: Günlük ihtiyacından 300-500 kcal az gir.<br />
                Protein: Vücut ağırlığının (kg) × 1.6-2.2 gramı kadar.<br />
                Su: En az 2-2.5 litre önerilir.
              </div>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving}
          style={{ background: c.a, color: '#0d0f14', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.6 : 1, transition: 'all 0.2s' }}>
          {saved ? '✓ Kaydedildi!' : saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}