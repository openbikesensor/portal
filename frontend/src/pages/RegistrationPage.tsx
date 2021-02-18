import React from 'react'
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'

import {Page, RegistrationForm} from '../components'

const RegistrationPage = connect((state) => ({loggedIn: Boolean(state.login)}))(function RegistrationPage({loggedIn}) {
  return loggedIn ? (
    <Redirect to="/" />
  ) : (
    <Page small>
      <h2>Register</h2>
      <RegistrationForm />
    </Page>
  )
})

export default RegistrationPage
