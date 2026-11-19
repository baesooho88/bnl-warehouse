import type { SupabaseClient } from '@supabase/supabase-js'

export const PERM_LABELS = { container: '컨테이너 상태 변경', calendar: '휴가 달력 편집' } as const
export type Perm = keyof typeof PERM_LABELS
export const ALL_PERMS = Object.keys(PERM_LABELS) as Perm[]
/** 직원에게 숨길 수 있는 탭(입출고는 늘 보임). 서버 표의 check와 같은 목록. */
export const HIDEABLE_TABS = ['RI', '통계', '달력', '검색'] as const
export type HideableTab = (typeof HIDEABLE_TABS)[number]
export interface StaffAccount { user_id: string; login_id: string; name: string; perms: Perm[]; hidden_tabs: HideableTab[] }

/** 관리자: 전체. 직원 개인 계정: 본인 한 줄(RLS). 공용 계정: 없음. */
export async function fetchAccounts(client: SupabaseClient): Promise<StaffAccount[]> {
  const { data, error } = await client.from('staff_accounts').select('user_id, login_id, name, perms, hidden_tabs').order('name')
  if (error) throw new Error(error.message)
  return data as StaffAccount[]
}

export async function updateAccount(client: SupabaseClient, userId: string, change: Partial<Pick<StaffAccount, 'perms' | 'hidden_tabs'>>): Promise<void> {
  const { error } = await client.from('staff_accounts').update(change).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/** 계정 만들기·지우기·PIN 바꾸기는 서버 함수. 실패하면 서버가 준 문장을 던진다. */
export async function accountAction(client: SupabaseClient, body: Record<string, unknown>): Promise<void> {
  const { error } = await client.functions.invoke('staff-accounts', { body })
  if (!error) return
  const msg = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => null)
  throw new Error(msg ?? '처리하지 못했어요. 인터넷을 확인해 주세요')
}
