import React from 'react'
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'

import {logout as logoutAction} from '../reducers/login'

const LogoutPage = connect(
  (state) => ({loggedIn: Boolean(state.login)}),
  (dispatch) => ({
    dispatchLogout: () => dispatch(logoutAction()),
  })
)(function LogoutPage({loggedIn, dispatchLogout}) {
  React.useEffect(() => {
    dispatchLogout()
  })

  return loggedIn ? null : <Redirect to="/" />
})

export default LogoutPage
