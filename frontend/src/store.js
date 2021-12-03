import {compose, createStore} from 'redux'
import persistState from 'redux-localstorage'

import rootReducer from './reducers'

const enhancer = compose(persistState(['login', 'mapConfig']))

const store = createStore(rootReducer, undefined, enhancer)

export default store
