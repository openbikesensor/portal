import React from 'react'
import {Button} from 'semantic-ui-react'

import api from 'api'

export default function LoginButton(props) {
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
      Login
    </Button>
  )
}
