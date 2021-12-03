import produce from 'immer'

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

export function setBasemapStyle(style: BaseMapStyle) {
  return {type: 'MAPCONFIG.SET_BASEMAP_STYLE', payload: {style}}
}

export default function mapConfigReducer(state = initialState, action) {
  switch (action.type) {
    case 'MAPCONFIG.SET_BASEMAP_STYLE':
      return produce(state, draft => {
        if (!draft.baseMap) {
          draft.baseMap = {}
        }
        draft.baseMap.style = action.payload.style
      })

    default:
      return state
  }
}
