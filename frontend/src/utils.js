import {useRef, useCallback} from 'react'
import {Duration} from 'luxon'

// Wraps the register callback from useForm into a new ref function, such that
// any child of the provided element that is an input component will be
// registered.
export function findInput(register) {
  return (element) => {
    const found = element ? element.querySelector('input, textarea, select, checkbox') : null
    register(found)
  }
}

// Generates pairs from the input iterable
export function* pairwise(it) {
  let lastValue
  let firstRound = true

  for (const i of it) {
    if (firstRound) {
      firstRound = false
    } else {
      yield [lastValue, i]
    }
    lastValue = i
  }
}

export function useCallbackRef(fn) {
  const fnRef = useRef()
  fnRef.current = fn
  return useCallback((...args) => fnRef.current(...args), [])
}

export function formatDuration(seconds) {
  return Duration.fromMillis((seconds ?? 0) * 1000).toFormat("h'h' mm'm'")
}

export function formatDistance(meters) {
  if (meters == null) return null

  if (meters < 0) return '-' + formatDistance(meters)

  if (meters < 1000) {
    return `${meters.toFixed(0)} m`
  } else {
    return `${(meters / 1000).toFixed(2)} km`
  }
}
