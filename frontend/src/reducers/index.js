import {combineReducers} from 'redux'

import login from './login'
import auth from './auth'

export default combineReducers({login, auth})
