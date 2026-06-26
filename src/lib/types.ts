export type User = {
  id: string
  username: string
  full_name: string | null
  avatar_color: string
  created_at: string
  calorie_goal?: number | null
  protein_goal?: number | null
  water_goal?: number | null
  step_goal?: number | null
  current_streak?: number
  longest_streak?: number
  last_active_date?: string | null
  rescues_used_this_month?: number
  rescues_month?: string | null
}

export type Duo = {
  id: string
  user_a: string
  user_b: string | null
  invite_code: string
  status: 'pending' | 'active'
  created_at: string
  partner?: User
}

export type DailyEntry = {
  id: string
  user_id: string
  duo_id: string
  date: string
  calories: number | null
  calories_goal: number | null
  protein: number | null
  protein_goal: number | null
  water: number | null
  steps: number | null
  total_burned: number | null
  total_workout: number | null
  activities: Activity[]
  created_at: string
}

export type Activity = {
  type: string
  duration: number
  burned: number
}

export type Measurement = {
  id: string
  user_id: string
  duo_id: string
  date: string
  weight: number | null
  height: number | null
  neck: number | null
  shoulder: number | null
  chest: number | null
  waist: number | null
  hip: number | null
  arm: number | null
  leg: number | null
}

export type Comment = {
  id: string
  duo_id: string
  user_id: string
  entry_date: string | null
  content: string
  created_at: string
  author?: User
}