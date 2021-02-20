import {Button} from  'semantic-ui-react'

import api from 'api'

export default function LoginButton(props)  {
  // TODO: Implement PKCE, generate login URL when clicked (with challenge),
  // and then redirect there.
  const href = api.getLoginUrl()
  return <Button as='a' href={href} {...props}>Login</Button>
}
