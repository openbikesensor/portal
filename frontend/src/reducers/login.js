const initialState = null

export function setLogin(user) {
  return {type: 'LOGIN.SET', payload: {user}}
}

export function resetLogin() {
  return {type: 'LOGIN.RESET'}
}

export default function loginReducer(state = initialState, action) {
  switch (action.type) {
    case 'LOGIN.SET':
      return action.payload.user

    case 'LOGIN.RESET':
      return null

    default:
      return state
  }
}
