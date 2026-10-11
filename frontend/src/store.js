import {createStore} from 'redux'
import rootReducer from './reducers'

const loadState = () => {
  try {
    const serialized = localStorage.getItem('redux')
    return serialized ? JSON.parse(serialized) : undefined
  } catch (e) {
    return undefined
  }
}

const saveState = (state) => {
  try {
    const toPersist = {login: state.login, mapConfig: state.mapConfig}
    localStorage.setItem('redux', JSON.stringify(toPersist))
  } catch (e) {}
}

const store = createStore(rootReducer, loadState())
store.subscribe(() => saveState(store.getState()))

export default store
