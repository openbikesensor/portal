import React from 'react'
import {Settings} from 'luxon'
import ReactDOM from 'react-dom'
import 'semantic-ui-less/semantic.less'

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
