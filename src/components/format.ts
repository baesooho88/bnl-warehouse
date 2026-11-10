export const num = (n: number | null) => (n === null ? '-' : n.toLocaleString('ko-KR'))
export const kg = (n: number | null) => (n === null ? '중량 -' : `${n.toLocaleString('ko-KR')}kg`)
export const tons = (kgSum: number) => `${(kgSum / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}t`
export const cbmText = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} CBM`
