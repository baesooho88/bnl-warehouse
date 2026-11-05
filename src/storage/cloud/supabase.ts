import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 공개 설정 값이 모두 있어야 클라우드 기능을 쓴다. 없으면 앱은 설정 안내를 보여 준다. */
export const cloudConfigured = Boolean(url && anonKey)

// 공개용 anon 키만 쓴다. 데이터 접근은 DB 권한 규칙(RLS)이 막는다.
export const supabase = createClient(url || 'http://localhost', anonKey || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
})
