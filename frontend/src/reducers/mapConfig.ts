import produce from 'immer'
import _ from 'lodash'

type BaseMapStyle = 'positron' | 'bright'

type RoadAttribute =
  | 'distance_overtaker_mean'
  | 'distance_overtaker_min'
  | 'distance_overtaker_max'
  | 'distance_overtaker_median'
  | 'overtaking_event_count'

export type MapConfig = {
  baseMap: {
    style: BaseMapStyle
  }
  obsRoads:{
    show: boolean
    showUntagged: boolean
    attribute: RoadAttribute
    maxCount: number
  }
}

export const initialState: MapConfig = {
  baseMap: {
    style: 'positron',
  },
  obsRoads: {
    show: true,
    showUntagged: true,
    attribute: 'distance_overtaker_median',
    maxCount: 20,
  },
}

type MapConfigAction =
  {type: 'MAP_CONFIG.SET_FLAG', payload: {flag: string, value: any}}

export function setMapConfigFlag(flag: string, value: unknown): MapConfigAction {
  return {type: 'MAP_CONFIG.SET_FLAG', payload: {flag, value}}
}

export default function mapConfigReducer(state: MapConfig = initialState, action: MapConfigAction) {
  switch (action.type) {
    case 'MAP_CONFIG.SET_FLAG':
      return produce(state, draft => {
        _.set(draft, action.payload.flag, action.payload.value)
      })

    default:
      return state
  }
}
