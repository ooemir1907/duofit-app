import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Basit rate limit - hafızada tutuyoruz (sunucu yeniden başlarsa sıfırlanır)
const userRequestCounts = new Map<string, { count: number, resetAt: number }>()
const DAILY_LIMIT = 10

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const record = userRequestCounts.get(userId)
  
  if (!record || now > record.resetAt) {
    userRequestCounts.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 })
    return true
  }
  
  if (record.count >= DAILY_LIMIT) {
    return false
  }
  
  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Kullanıcı doğrulama
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmalısın' }, { status: 401 })
    }

    // Rate limit kontrolü
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Günlük sorgu limitine ulaştın (10/gün). Yarın tekrar dene.' }, { status: 429 })
    }

    const { description } = await request.json()

    if (!description || description.trim().length < 3) {
      return NextResponse.json({ error: 'Lütfen ne yediğini yaz' }, { status: 400 })
    }

    if (description.length > 500) {
      return NextResponse.json({ error: 'Açıklama çok uzun (max 500 karakter)' }, { status: 400 })
    }

    // Anthropic API çağrısı
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Sen bir beslenme uzmanı asistanısın. Kullanıcının yediği yemeği analiz et ve JSON formatında SADECE şu yapıda cevap ver, başka hiçbir açıklama ekleme:

{"calories": sayı, "protein": sayı, "carbs": sayı, "fat": sayı, "summary": "kısa özet türkçe"}

Tahminlerini gram bazlı standart porsiyon büyüklüklerine göre yap. Türkiye'deki yaygın yemekleri baz al.

Kullanıcının yediği: "${description}"`
        }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', errText)
      return NextResponse.json({ error: 'Hesaplama sırasında hata oluştu' }, { status: 500 })
    }

    const data = await response.json()
    const textContent = data.content?.[0]?.text || ''
    
    // JSON'u parse et
    const jsonMatch = textContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Sonuç anlaşılamadı, tekrar dene' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      calories: Math.round(result.calories) || 0,
      protein: Math.round(result.protein) || 0,
      carbs: Math.round(result.carbs) || 0,
      fat: Math.round(result.fat) || 0,
      summary: result.summary || description,
    })

  } catch (error) {
    console.error('Calculate meal error:', error)
    return NextResponse.json({ error: 'Beklenmeyen bir hata oluştu' }, { status: 500 })
  }
}