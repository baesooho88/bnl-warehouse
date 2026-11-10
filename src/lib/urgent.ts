/** 입고 비고에 '긴급'이 적혀 있으면 긴급건(실제 파일에서 긴급건은 이렇게 표시됨) */
export const isUrgent = (note: string | null) => note?.includes('긴급') ?? false
