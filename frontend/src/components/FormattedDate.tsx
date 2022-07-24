import {DateTime} from 'luxon'
import {useTranslation} from 'react-i18next'

export default function FormattedDate({date, relative = false}) {
  if (date == null) {
    return null
  }

  const dateTime =
    typeof date === 'string' ? DateTime.fromISO(date) : date instanceof Date ? DateTime.fromJSDate(date) : date

  let str

  const {i18n} = useTranslation()
  const locale = i18n.language

  if (relative) {
    str = dateTime.setLocale(locale).toRelative()
  } else {
    str = dateTime.setLocale(locale).toLocaleString(DateTime.DATETIME_MED)
  }

  const iso = dateTime.toISO()
  return <time dateTime={iso} title={iso}>{str}</time>
}
