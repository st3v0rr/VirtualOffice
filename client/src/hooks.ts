import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from './stores'
import { getBackgroundModeForTime, setBackgroundMode } from './stores/UserStore'

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

// switch the background between day and night following the time of day
export function useAutoBackgroundMode() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(setBackgroundMode(getBackgroundModeForTime()))
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [dispatch])
}
