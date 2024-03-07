import {useMemo} from 'react'
import {useSelector} from 'react-redux'
import produce from 'immer'
import _ from 'lodash'

type BaseMapStyle = 'positron' | 'bright'

type RoadAttribute =
  | 'distance_overtaker_mean'
  | 'distance_overtaker_min'
  | 'distance_overtaker_max'
  | 'distance_overtaker_median'
  | 'overtaking_event_count'
  | 'segment_length'
  | 'usage_count'
  | 'zone'
  | 'combined_score'
  | 'overtaking_legality'
  | 'overtaking_frequency'

export type MapConfig = {
  baseMap: {
    style: BaseMapStyle
  }
  obsRoads: {
    show: boolean
    showUntagged: boolean
    attribute: RoadAttribute
    maxCount: number
  }
  obsEvents: {
    show: boolean
  }
  obsRegions: {
    show: boolean
  }
  filters: {
    currentUser: boolean
    dateMode: 'none' | 'range' | 'threshold'
    startDate?: null | string
    endDate?: null | string
    thresholdAfter?: null | boolean
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
  obsEvents: {
    show: false,
  },
  obsRegions: {
    show: true,
  },
  filters: {
    currentUser: false,
    dateMode: 'none',
    startDate: null,
    endDate: null,
    thresholdAfter: true,
  },
}

type MapConfigAction = {
  type: 'MAP_CONFIG.SET_FLAG'
  payload: {flag: string; value: any}
}

export function setMapConfigFlag(flag: string, value: unknown): MapConfigAction {
  return {type: 'MAP_CONFIG.SET_FLAG', payload: {flag, value}}
}

export function useMapConfig() {
  const mapConfig = useSelector((state) => state.mapConfig)
  const result = useMemo(() => _.merge({}, initialState, mapConfig), [mapConfig])
  return result
}

export default function mapConfigReducer(state: MapConfig = initialState, action: MapConfigAction) {
  switch (action.type) {
    case 'MAP_CONFIG.SET_FLAG':
      return produce(state, (draft) => {
        _.set(draft, action.payload.flag, action.payload.value)
      })

    default:
      return state
  }
}
