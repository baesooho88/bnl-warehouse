// source/ 의 원본 엑셀(개인정보 포함, git 제외)로 익명화된 테스트 자료 tests/fixtures/*.xlsx 를 만든다.
// 마지막에 원본의 이름·전화번호·MEMO가 픽스처에 남았는지 검사하고, 남았으면 실패한다.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'

const SRC = 'source'
const OUT = 'tests/fixtures'
const PHONE = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g
const FAKE_PHONE = '010-0000-0000'

const norm = (s) => String(s ?? '').replace(/\s+/g, '').toUpperCase()
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.xlsx')).sort()
const pick = (word) => {
  const list = files.filter((f) => f.normalize('NFC').includes(word))
  if (!list.length) throw new Error(`source/ 에 '${word}' 파일이 없습니다`)
  return list[list.length - 1]
}

const secrets = new Set() // 원본에서 나온, 픽스처에 있으면 안 되는 문자열
const aliases = new Map()

function eachStringCell(ws, fn) {
  for (const addr of Object.keys(ws)) {
    if (addr[0] === '!') continue
    const c = ws[addr]
    if (c.t === 's' && typeof c.v === 'string') fn(c, XLSX.utils.decode_cell(addr))
  }
}
function setText(c, text) {
  c.v = text
  c.t = 's'
  delete c.w
  delete c.h
  delete c.r
}

function anonymize(wb, isOutbound) {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    let reqCol = -1
    let memoCol = -1
    let headerRow = -1
    if (isOutbound) {
      eachStringCell(ws, (c, { r, c: col }) => {
        if (norm(c.v) === '신청자명') { reqCol = col; headerRow = r }
        if (norm(c.v) === 'MEMO') memoCol = col
      })
    }
    eachStringCell(ws, (c, { r, c: col }) => {
      for (const m of c.v.match(PHONE) ?? []) secrets.add(m)
      if (isOutbound && r > headerRow && headerRow >= 0 && col === reqCol && c.v.trim()) {
        const real = c.v.trim()
        secrets.add(real)
        if (!aliases.has(real)) aliases.set(real, `신청자${String.fromCharCode(65 + aliases.size)}`)
        setText(c, aliases.get(real))
        return
      }
      if (isOutbound && r > headerRow && headerRow >= 0 && col === memoCol && c.v.trim()) {
        // 시각만 적힌 MEMO('13시')는 다른 칸의 정상 값과 겹치므로 검사 대상에서 뺀다. 칸은 어쨌든 통째로 바꾼다.
        const hangul = c.v.replace(/[시분]/g, '').match(/[가-힣]/g) ?? []
        if (hangul.length >= 2 || PHONE.test(c.v)) secrets.add(c.v.trim())
        PHONE.lastIndex = 0
        setText(c, `담당자 ${FAKE_PHONE}`)
        return
      }
      if (c.v.includes('작성자')) {
        const who = c.v.split(':')[1]?.trim()
        if (who) secrets.add(who)
        setText(c, '작성자 : 작성자')
        return
      }
      if (PHONE.test(c.v)) setText(c, c.v.replace(PHONE, FAKE_PHONE))
      PHONE.lastIndex = 0
    })
  }
}

fs.mkdirSync(OUT, { recursive: true })
const jobs = [
  ['북항', 'bukhang.xlsx', false],
  ['신항', 'sinhang.xlsx', false],
  ['출하요청서', 'outbound.xlsx', true],
]
for (const [word, outName, isOutbound] of jobs) {
  const src = pick(word)
  const wb = XLSX.read(fs.readFileSync(path.join(SRC, src)))
  for (const v of Object.values({ ...wb.Props, ...wb.Custprops })) if (typeof v === 'string' && v.trim()) secrets.add(v.trim())
  anonymize(wb, isOutbound)
  // 문서 속성(만든 사람·마지막 수정한 사람 등)에도 실명이 들어 있으므로 통째로 비운다
  wb.Props = {}
  delete wb.Custprops
  fs.writeFileSync(path.join(OUT, outName), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  console.log(`${src.normalize('NFC')} → ${OUT}/${outName}`)
}

// 잔존 검사
let leaks = 0
for (const [, outName] of jobs) {
  const wb = XLSX.read(fs.readFileSync(path.join(OUT, outName)))
  for (const v of Object.values({ ...wb.Props, ...wb.Custprops })) {
    if (typeof v === 'string' && [...secrets].some((s) => s.length >= 2 && v.includes(s))) {
      leaks++
      console.error(`잔존: ${outName} 문서 속성`)
    }
  }
  for (const name of wb.SheetNames) {
    eachStringCell(wb.Sheets[name], (c) => {
      for (const s of secrets) {
        if (s.length >= 2 && c.v.includes(s)) {
          leaks++
          console.error(`잔존: ${outName} ${name} → ${JSON.stringify(c.v)}`)
        }
      }
    })
  }
}
// git에 올라가는(또는 올라갈) 모든 텍스트 파일도 검사한다 — 문서·테스트에 원본 값을 옮겨 적는 실수 방지
const tracked = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean)
for (const file of tracked) {
  if (/\.(xlsx|png|ico)$/i.test(file) || file === 'package-lock.json' || !fs.existsSync(file)) continue
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if ([...secrets].some((s) => s.length >= 2 && line.includes(s))) {
      leaks++
      console.error(`잔존: ${file}:${i + 1}`) // 값은 출력하지 않는다
    }
  })
}
if (leaks) {
  console.error(`개인정보 ${leaks}건이 남아 있습니다. 픽스처를 커밋하지 마세요.`)
  process.exit(1)
}
console.log(`개인정보 잔존 0건 (검사한 원본 문자열 ${secrets.size}개)`)
