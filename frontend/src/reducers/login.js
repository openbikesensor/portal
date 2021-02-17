const initialState = null

export function login(user) {
  return {type: 'LOGIN.LOGIN', payload: {user}}
}

export function logout() {
  return {type: 'LOGIN.LOGOUT'}
}

export default function loginReducer(state = initialState, action) {
  switch (action.type) {
    case 'LOGIN.LOGIN':
      return action.payload.user
    case 'LOGIN.LOGOUT':
      return null
    default:
      return state
  }
}
