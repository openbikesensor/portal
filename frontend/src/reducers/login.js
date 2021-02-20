const initialState = null

export function setLogin(user) {
  return {type: 'LOGIN.SET', payload: {user}}
}

export default function loginReducer(state = initialState, action) {
  switch (action.type) {
    case 'LOGIN.SET':
      return action.payload.user

    case 'AUTH.RESET': // cross reducer action :)
      return null

    default:
      return state
  }
}
