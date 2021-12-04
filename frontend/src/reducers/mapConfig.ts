import produce from 'immer'
import _ from 'lodash'

type BaseMapStyle = 'positron' | 'bright'
type MapConfigState  = {
  baseMap: {
    style: BaseMapStyle
  }
}

const initialState: MapConfigState = {
  baseMap: {
    style: 'positron',
  },
}

export function setMapConfigFlag(flag: string, value: unknown) {
  return {type: 'MAPCONFIG.SET_FLAG', payload: {flag, value}}
}

export default function mapConfigReducer(state = initialState, action) {
  switch (action.type) {
    case 'MAPCONFIG.SET_FLAG':
      return produce(state, draft => {
        _.set(draft, action.payload.flag, action.payload.value)
      })

    default:
      return state
  }
}
