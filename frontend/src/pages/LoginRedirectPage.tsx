import React from 'react'
import {connect} from 'react-redux'
import {Redirect, useLocation, useHistory} from 'react-router-dom'
import {Icon, Message} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {switchMap, pluck, distinctUntilChanged} from 'rxjs/operators'

import {Page} from 'components'
import api from 'api'

const LoginRedirectPage = connect((state) => ({loggedIn: Boolean(state.login)}))(function LoginRedirectPage({
  loggedIn,
}) {
  const location = useLocation()
  const history = useHistory()
  const {search} = location

  /* eslint-disable react-hooks/exhaustive-deps */

  // Hook dependency arrays in this block are intentionally left blank, we want
  // to keep the initial state, but reset the url once, ASAP, to not leak the
  // query parameters. This is considered good practice by OAuth.
  const searchParams = React.useMemo(() => Object.fromEntries(new URLSearchParams(search).entries()), [])

  React.useEffect(() => {
    history.replace({...location, search: ''})
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  if (loggedIn) {
    return <Redirect to="/" />
  }

  const {error, error_description: errorDescription, code} = searchParams

  if (error) {
    return (
      <Page small title="Login error">
        <Message icon error>
          <Icon name="warning sign" />
          <Message.Content>
            <Message.Header>Login error</Message.Header>
            The login server reported: {errorDescription || error}.
          </Message.Content>
        </Message>
      </Page>
    )
  }

  return <ExchangeAuthCode code={code} />
})

function ExchangeAuthCode({code}) {
  const result = useObservable(
    (_$, args$) =>
      args$.pipe(
        pluck(0),
        distinctUntilChanged(),
        switchMap((code) => api.exchangeAuthorizationCode(code))
      ),
    null,
    [code]
  )

  let content
  if (result === null) {
    content = (
      <Message icon info>
        <Icon name="circle notched" loading />
        <Message.Content>
          <Message.Header>Logging you in</Message.Header>
          Hang tight...
        </Message.Content>
      </Message>
    )
  } else if (result === true) {
    content = <Redirect to="/" />
  } else {
    const {error, error_description: errorDescription} = result
    content = (
      <>
        <Message icon error>
          <Icon name="warning sign" />
          <Message.Content>
            <Message.Header>Login error</Message.Header>
            The login server reported: {errorDescription || error}.
          </Message.Content>
        </Message>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </>
    )
  }

  return <Page small title="Login">{content}</Page>
}

export default LoginRedirectPage
