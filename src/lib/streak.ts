export function isConsecutiveDay(lastDate: string | null | undefined, today: string): 'continue' | 'same' | 'broken' {
  if (!lastDate) return 'broken'
  const last = new Date(lastDate)
  const current = new Date(today)
  const diffDays = Math.round((current.getTime() - last.getTime()) / 86400000)
  if (diffDays === 0) return 'same'
  if (diffDays === 1) return 'continue'
  return 'broken'
}

export function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

export const MOTIVATION_QUESTIONS = [
  {
    question: 'Bugün neden veri girmedin?',
    options: ['Unuttum', 'Çok yorgundum', 'Hastaydım', 'Seyahatteydim', 'Diğer']
  },
  {
    question: 'Bir dahaki sefere unutmamak için ne yapacaksın?',
    options: ['Hatırlatıcı kuracağım', 'Sabah ilk iş gireceğim', 'Duomdan hatırlatması isteyeceğim', 'Diğer']
  }
]

export function getRandomQuestions() {
  return MOTIVATION_QUESTIONS
}