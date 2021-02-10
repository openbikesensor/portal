import {useMemo} from 'react'
import {useHistory} from 'react-router-dom'

type QueryValue = string | number
type QueryParams = {[key: string]: QueryValue}

export function parseValue(value: string): null | QueryValue {
  // empty or `-` values should be represented as `null`
  if (value === '-' || value === '') {
    return null
  }

  // `isNaN` understands numeric strings as numbers, but also detects empty
  // strings and `null` as such. We only want to parse strings that are
  // numeric and not empty, therefore this check is a bit more complicated.
  if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) {
    return parseFloat(value)
  }

  return value
}

export function parseQuery(search: string): QueryParams {
  const result: QueryParams = {}

  const params = new URLSearchParams(search)
  for (const entry of params.entries()) {
    const [key, value_] = entry
    const v = parseValue(value_)
    if (v != null) {
      result[key] = v
    }
  }
  return result
}

export const stringifyParams = (params: Record<string, any>) => {
  if (!params) {
    return ''
  }

  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    usp.append(key, typeof value === 'object' ? JSON.stringify(value) : value)
  }
  return usp.toString()
}

export function useQueryParam<T extends QueryValue>(
  name: string,
  defaultValue: T | null = null,
  convert: (t: T | null) => T | null = (x) => x
): [T, (newValue: T) => void] {
  const history = useHistory()
  const {[name]: value = defaultValue} = (parseQuery(history.location.search) as unknown) as {
    [name: string]: T
  }
  const setter = useMemo(
    () => (newValue: T) => {
      // We're re-parsing the query here, because it might have been
      // changed simulatenously with this call, and the
      // history.location.search will already be updated, but react might
      // not have rerendered yet. Yes, this is access to some global
      // state, but that is okay, since there is just one browser history
      // at any time.
      const {[name]: _oldValue, ...queryParams} = parseQuery(history.location.search)

      const newQueryParams = {
        ...queryParams,
        ...(newValue == null || (newValue as any) === defaultValue ? {} : {[name]: newValue}),
      }

      const queryString = stringifyParams(newQueryParams)
      history.replace({...history.location, search: '?' + queryString})
    },
    [name, history, defaultValue]
  )

  const result: T = (convert(value) ?? defaultValue) as any
  return [result, setter]
}
