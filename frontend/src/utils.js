import {useRef, useCallback} from 'react'

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
  return useCallback(((...args) => fnRef.current(...args)), [])
}
