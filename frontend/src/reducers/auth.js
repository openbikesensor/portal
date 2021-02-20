const initialState = null

export function setAuth(auth) {
  return {type: 'AUTH.SET', payload: {auth}}
}

export function resetAuth() {
  return {type: 'AUTH.RESET'}
}

export function invalidateAccessToken() {
  return {type: 'AUTH.INVALIDATE_ACCESS_TOKEN'}
}

export default function loginReducer(state = initialState, action) {
  switch (action.type) {
    case 'AUTH.SET':
      return action.payload.auth
    case 'AUTH.INVALIDATE_ACCESS_TOKEN':
      return state && {
        ...state,
        accessToken: null,
        expiresAt: 0,
      }
    case 'AUTH.RESET':
      return null
    default:
      return state
  }
}
