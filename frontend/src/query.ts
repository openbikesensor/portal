import {useMemo} from 'react'
import {useNavigate, useLocation} from 'react-router-dom'

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
  const navigate = useNavigate()
  const location = useLocation()
  const {[name]: value = defaultValue} = (parseQuery(location.search) as unknown) as {
    [name: string]: T
  }
  const setter = useMemo(
    () => (newValue: T) => {
      const {[name]: _oldValue, ...queryParams} = parseQuery(location.search)

      const newQueryParams = {
        ...queryParams,
        ...(newValue == null || (newValue as any) === defaultValue ? {} : {[name]: newValue}),
      }

      const queryString = stringifyParams(newQueryParams)
      navigate({...location, search: queryString ? '?' + queryString : ''}, {replace: true})
    },
    [name, navigate, location, defaultValue]
  )

  const result: T = (convert(value) ?? defaultValue) as any
  return [result, setter]
}
