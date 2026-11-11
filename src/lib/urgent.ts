/** 입고 비고에 '긴급'이 적혀 있으면 긴급건(실제 파일에서 긴급건은 이렇게 표시됨) */
export const isUrgent = (note: string | null) => note?.includes('긴급') ?? false

/** 출하요청서 '입고 검수 일자'에 날짜 대신 '대기'가 적혀 있으면 검사가 필요한 건(날짜가 아니라 raw에 원문이 남는다) */
// done: RI에서 검사 완료한 B/L — 엑셀엔 아직 '대기'여도 더는 검사필요가 아니다
export const needsInspection = (
  x: { inspectedDate: string | null; raw: Record<string, string>; bl?: string | null },
  done?: { has: (bl: string) => boolean },
) => !x.inspectedDate && (x.raw['입고검수일자'] ?? '').includes('대기') && !(x.bl && done?.has(x.bl))
