import React from 'react'
import {Icon} from 'semantic-ui-react'
import {useTranslation} from 'react-i18next'

export default function Visibility({public: public_}: {public: boolean}) {
  const {t} = useTranslation()
  const icon = public_ ? <Icon color="blue" name="eye" fitted /> : <Icon name="eye slash" fitted />
  const text = public_ ? t('general.public') : t('general.private')
  return (
    <>
      {icon} {text}
    </>
  )
}
