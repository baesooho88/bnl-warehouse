// Node(테스트)와 Deno(Edge Function) 양쪽에서 쓰므로 외부 import 없이 Web Crypto만 쓴다.

export const LOCK_WINDOW_MIN = 15
export const LOCK_THRESHOLD = 20
export const PIN_PATTERN = /^\d{6}$/

/** 최근 LOCK_WINDOW_MIN분 동안의 전체 실패 횟수로 잠금 여부를 정한다. */
export const isLocked = (recentFailures: number) => recentFailures >= LOCK_THRESHOLD

const ITERATIONS = 100_000
const enc = new TextEncoder()
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string) => (/^([0-9a-f]{2})+$/.test(h) ? new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16))) : null)

async function derive(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256)
  return new Uint8Array(bits)
}

/** 저장 형식: pbkdf2$<salt hex>$<hash hex>. PIN 원문은 저장하지 않는다. */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${toHex(salt)}$${toHex(await derive(pin, salt))}`
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  const salt = fromHex(saltHex ?? '')
  const expected = fromHex(hashHex ?? '')
  if (scheme !== 'pbkdf2' || !salt || !expected) return false
  const actual = await derive(pin, salt)
  if (actual.length !== expected.length) return false
  let diff = 0 // 길이가 같은 바이트를 끝까지 비교 (시간 차이로 정답을 추측하지 못하게)
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}
