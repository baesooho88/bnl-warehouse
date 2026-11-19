// Node(테스트)·Deno 공용. 직원 개인 계정 규칙.
export const PERMS = ['container', 'calendar'] as const
export const LOGIN_ID_PATTERN = /^[a-z0-9]{2,20}$/
/** auth 사용자 이메일(실제로 메일을 보내지 않는 주소) */
export const staffEmail = (loginId: string) => `${loginId}@staff.bnl.invalid`
