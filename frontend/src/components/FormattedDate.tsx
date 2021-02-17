import {DateTime} from 'luxon'

export default function FormattedDate({date, relative = false}) {
  if (date == null) {
    return null
  }

  const dateTime =
    typeof date === 'string' ? DateTime.fromISO(date) : date instanceof Date ? DateTime.fromJSDate(date) : date

  let str

  if (relative) {
    str = dateTime.toRelative()
  } else {
    str = dateTime.toLocaleString(DateTime.DATETIME_MED)
  }

  return <span title={dateTime.toISO()}>{str}</span>
}
