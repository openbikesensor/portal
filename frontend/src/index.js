import React from 'react'
import {Settings} from 'luxon'
import ReactDOM from 'react-dom'
import 'semantic-ui-css/semantic.min.css'
import './index.css'
import App from './App'

import {Provider} from 'react-redux'

import store from './store'

// TODO: remove
Settings.defaultLocale = 'de-DE'

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
)
