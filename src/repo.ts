import { createDexieRepository } from './storage/dexieRepository'

/** 앱 전체가 쓰는 저장소. v2에서는 여기만 클라우드 구현으로 바꾼다. */
export const repo = createDexieRepository()
