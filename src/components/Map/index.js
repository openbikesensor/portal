import React from 'react'

import OlMap from 'ol/Map'
import OlView from 'ol/View'
import OlTileLayer from 'ol/layer/Tile'
import OlVectorLayer from 'ol/layer/Vector'
import OlGroupLayer from 'ol/layer/Group'
import OSM from 'ol/source/OSM'
import proj4 from 'proj4'
import {register} from 'ol/proj/proj4'

// Import styles for open layers + addons
import 'ol/ol.css'

// Prepare projection
proj4.defs(
  'projLayer1',
  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs'
)
register(proj4)

const MapContext = React.createContext()
const MapLayerContext = React.createContext()

export function Map({children, ...props}) {
  const ref = React.useRef()

  const [map, setMap] = React.useState(null)

  React.useLayoutEffect(() => {
    const map = new OlMap({target: ref.current})

    setMap(map)

    return () => {
      map.setTarget(null)
      setMap(null)
    }
  }, [])

  return (
    <>
      <div ref={ref} {...props}>
        {map && (
          <MapContext.Provider value={map}>
            <MapLayerContext.Provider value={map.getLayers()}>{children}</MapLayerContext.Provider>
          </MapContext.Provider>
        )}
      </div>
    </>
  )
}

export function Layer({layerClass, getDefaultOptions, children, ...props}) {
  const context = React.useContext(MapLayerContext)

  const layer = React.useMemo(
    () =>
      new layerClass({
        ...(getDefaultOptions ? getDefaultOptions() : {}),
        ...props,
      }),
    []
  )

  for (const [k, v] of Object.entries(props)) {
    layer.set(k, v)
  }

  React.useEffect(() => {
    context?.push(layer)
    return () => context?.remove(layer)
  }, [layer, context])

  if (typeof layer.getLayers === 'function') {
    return <MapLayerContext.Provider value={layer.getLayers()}>{children}</MapLayerContext.Provider>
  } else {
    return null
  }
}

export function TileLayer(props) {
  return <Layer layerClass={OlTileLayer} getDefaultOptions={() => ({source: new OSM()})} {...props} />
}

export function VectorLayer(props) {
  return <Layer layerClass={OlVectorLayer} {...props} />
}

export function GroupLayer(props) {
  return <Layer layerClass={OlGroupLayer} {...props} />
}

function FitView({extent}) {
  const map = React.useContext(MapContext)

  React.useEffect(() => {
    if (extent && map) {
      map.getView().fit(extent)
    }
  }, [extent, map])

  return null
}

function View({...options}) {
  const map = React.useContext(MapContext)

  const view = React.useMemo(
    () =>
      new OlView({
        ...options,
      }),
    []
  )

  React.useEffect(() => {
    if (view && map) {
      map.setView(view)
    }
  }, [view, map])

  return null
}

Map.FitView = FitView
Map.GroupLayer = GroupLayer
Map.TileLayer = TileLayer
Map.VectorLayer = VectorLayer
Map.View = View

export default Map
