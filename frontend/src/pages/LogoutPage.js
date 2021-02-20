import React from 'react'
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'

import {resetAuth} from 'reducers/auth'

const LogoutPage = connect(
  (state) => ({loggedIn: Boolean(state.login)}),
  {resetAuth}
)(function LogoutPage({loggedIn, resetAuth}) {
  React.useEffect(() => {
    resetAuth()
  })

  return loggedIn ? null : <Redirect to="/" />
})

export default LogoutPage
