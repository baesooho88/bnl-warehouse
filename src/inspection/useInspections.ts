import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../storage/cloud/supabase'
import { fetchDone, onDoneChange } from './inspections'

/** 검사 완료한 B/L(→ 완료 시각). 서버에서 읽고 바뀌면 실시간으로 다시 읽는다. 오프라인·실패면 빈 표. */
export function useInspections() {
  const [done, setDone] = useState<Map<string, string>>(new Map())
  const load = useCallback(() => {
    let alive = true
    fetchDone(supabase).then((m) => alive && setDone(m)).catch(() => {})
    return () => { alive = false }
  }, [])
  useEffect(load, [load])
  useEffect(() => onDoneChange(supabase, () => void load()), [load])
  return { done, reload: load }
}
