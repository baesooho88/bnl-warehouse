import { createSupabaseRemote } from './storage/cloud/remote'
import { supabase } from './storage/cloud/supabase'
import { createCloudRepository } from './storage/cloudRepository'
import { createDexieRepository } from './storage/dexieRepository'
import { createSync } from './sync/sync'

/** 휴대폰 안 사본 (화면은 이것만 읽는다) */
export const local = createDexieRepository()
export const remote = createSupabaseRemote(supabase)

let currentFileName = ''
export const setCurrentFileName = (name: string) => { currentFileName = name }

/** 앱 전체가 쓰는 저장소: 읽기 = 휴대폰 사본, 쓰기 = 클라우드 먼저 */
export const repo = createCloudRepository(local, remote, () => currentFileName)
export const sync = createSync({ local, remote })
