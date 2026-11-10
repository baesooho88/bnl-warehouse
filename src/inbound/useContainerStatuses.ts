import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../storage/cloud/supabase'
import { fetchStatuses, onStatusChange, type ContainerStatus } from './containerStatus'

/** 보이는 B/L들의 컨테이너 상태. 서버에서 읽고, 바뀌면 실시간으로 다시 읽는다. 오프라인·실패면 빈 표(=입고예정). */
export function useContainerStatuses(bls: string[]) {
  const key = [...new Set(bls)].sort().join(',')
  const [statuses, setStatuses] = useState<Map<string, ContainerStatus>>(new Map())
  const load = useCallback(() => {
    let alive = true
    fetchStatuses(supabase, key ? key.split(',') : []).then((m) => alive && setStatuses(m)).catch(() => {})
    return () => { alive = false }
  }, [key])
  useEffect(load, [load])
  useEffect(() => (key ? onStatusChange(supabase, () => void load()) : undefined), [key, load])
  return { statuses, reload: load }
}
