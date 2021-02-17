import React from 'react'
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'

import styles from './LoginPage.module.scss'
import {Page, LoginForm} from '../components'

const LoginPage = connect((state) => ({loggedIn: Boolean(state.login)}))(function LoginPage({loggedIn}) {
  return loggedIn ? (
    <Redirect to="/" />
  ) : (
    <Page>
      <h2>Login</h2>
      <LoginForm className={styles.loginForm} />
    </Page>
  )
})

export default LoginPage
