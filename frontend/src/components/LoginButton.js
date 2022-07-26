import React from 'react'
import {Button} from 'semantic-ui-react'
import {useTranslation} from 'react-i18next'

import api from 'api'

export default function LoginButton(props) {
  const {t} = useTranslation()
  const [busy, setBusy] = React.useState(false)

  const onClick = React.useCallback(
    async (e) => {
      e.preventDefault()
      setBusy(true)
      const url = await api.makeLoginUrl()
      window.location.href = url
      setBusy(false)
    },
    [setBusy]
  )

  return (
    <Button onClick={busy ? null : onClick} loading={busy} {...props}>
      {t('LoginButton.login')}
    </Button>
  )
}
