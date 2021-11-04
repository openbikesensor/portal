import React from 'react'
import {Loader} from 'semantic-ui-react'
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'

import api from 'api'

const LogoutPage = connect(
  (state) => ({loggedIn: Boolean(state.login)}),
)(function LogoutPage({loggedIn}) {
  React.useEffect(() => {
    // no await, just trigger it
    if (loggedIn) {
      api.logout()
    }
  }, [loggedIn])

  return loggedIn ? <Loader active /> : <Redirect to="/" />
})

export default LogoutPage
