import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { json } from './http.ts'

export const env = (name: string) => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`환경 변수 ${name} 없음`)
  return v
}

/** service role 클라이언트 (RLS 무시). 이 함수 안에서만 쓴다. */
export const serviceClient = (): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

/** 호출자가 관리자(app_metadata.role = admin)인지 확인. 아니면 403 응답을 돌려준다. */
export async function requireAdmin(req: Request): Promise<{ userId: string } | Response> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)
  const { data, error } = await serviceClient().auth.getUser(token)
  if (error || !data.user) return json({ error: 'unauthorized' }, 401)
  if (data.user.app_metadata?.role !== 'admin') return json({ error: 'forbidden' }, 403)
  return { userId: data.user.id }
}
