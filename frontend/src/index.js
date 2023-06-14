import React, {Suspense} from 'react'
import {Settings} from 'luxon'
import ReactDOM from 'react-dom'
import 'fomantic-ui-less/semantic.less'

import './index.less'
import App from './App'

import 'maplibre-gl/dist/maplibre-gl.css'

import {Provider} from 'react-redux'

import store from './store'
import './i18n'

// TODO: remove
Settings.defaultLocale = 'de-DE'

ReactDOM.render(
  <Provider store={store}>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </Provider>,
  document.getElementById('root')
)
