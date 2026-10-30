import React, {Suspense} from 'react'
import {Settings} from 'luxon'
import {createRoot} from 'react-dom/client'
import 'fomantic-ui-less/semantic.less'

import './index.less'
import App from './App'

import 'maplibre-gl/dist/maplibre-gl.css'

import {Provider} from 'react-redux'

import store from './store'
import './i18n'

// TODO: remove
Settings.defaultLocale = 'de-DE'

const container = document.getElementById('root')
const root = createRoot(container)
root.render(
  <Provider store={store}>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </Provider>
)
