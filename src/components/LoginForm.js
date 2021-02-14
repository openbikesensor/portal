import React from 'react'
import {connect} from 'react-redux'
import {Form, Button} from 'semantic-ui-react'

import {login as loginAction} from '../reducers/login'

async function fetchLogin(email, password) {
  const response = await window.fetch('/api/users/login', {
    body: JSON.stringify({user: {email, password}}),
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })

  const result = await response.json()

  if (result.user) {
    return result.user
  } else {
    throw new Error('invalid credentials')
  }
}

const LoginForm = connect(
  (state) => ({loggedIn: Boolean(state.login)}),
  (dispatch) => ({
    dispatchLogin: (user) => dispatch(loginAction(user)),
  })
)(function LoginForm({loggedIn, dispatchLogin, className}) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const onChangeEmail = React.useCallback((e) => setEmail(e.target.value), [])
  const onChangePassword = React.useCallback((e) => setPassword(e.target.value), [])

  const onSubmit = React.useCallback(() => fetchLogin(email, password).then(dispatchLogin), [
    email,
    password,
    dispatchLogin,
  ])

  return loggedIn ? null :(
      <Form className={className} onSubmit={onSubmit}>
        <Form.Field>
          <label>e-Mail</label>
          <input value={email} onChange={onChangeEmail} />
        </Form.Field>
        <Form.Field>
          <label>Password</label>
          <input type="password" value={password} onChange={onChangePassword} />
        </Form.Field>
        <Button type="submit">Submit</Button>
      </Form>
  )
})

export default LoginForm
