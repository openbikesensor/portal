import React from 'react'
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'

import {Page, LoginForm} from '../components'

const LoginPage = connect((state) => ({loggedIn: Boolean(state.login)}))(function LoginPage({loggedIn}) {
  return loggedIn ? (
    <Redirect to="/" />
  ) : (
    <Page small>
      <h2>Login</h2>
      <LoginForm  />
    </Page>
  )
})

export default LoginPage
