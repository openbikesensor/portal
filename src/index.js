import React from 'react'
import {Settings} from 'luxon'
import ReactDOM from 'react-dom'
import 'semantic-ui-css/semantic.min.css'
import './index.css'
import App from './App'

import {Provider} from 'react-redux'
import {compose, createStore} from 'redux'
import persistState from 'redux-localstorage'

import rootReducer from './reducers'

const enhancer = compose(persistState(['login']))

const store = createStore(rootReducer, undefined, enhancer)

// TODO: remove
Settings.defaultLocale = 'de-DE'

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
)

