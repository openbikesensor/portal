import React from 'react'
import {Settings} from 'luxon'
import ReactDOM from 'react-dom'
import 'semantic-ui-css/semantic.min.css'
import './index.css'
import App from './App'

import { store } from './store';

import {Provider} from 'react-redux'

// TODO: remove
Settings.defaultLocale = 'de-DE'

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
)
