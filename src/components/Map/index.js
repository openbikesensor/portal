import React from 'react'

import OlMap from 'ol/Map'
import OlView from 'ol/View'
import OlTileLayer from 'ol/layer/Tile'
import OlVectorLayer from 'ol/layer/Vector'
import OlGroupLayer from 'ol/layer/Group'
import {fromLonLat} from 'ol/proj'
import OSM from 'ol/source/OSM'

import OlLayerSwitcher from 'ol-layerswitcher'

import 'ol/ol.css'
import "ol-layerswitcher/dist/ol-layerswitcher.css";

const MapContext = React.createContext()
const MapLayerContext = React.createContext()

export function Map({children, ...props}) {
  const ref = React.useRef()

  const [map, setMap] = React.useState(null)

  React.useLayoutEffect(() => {
    const map = new OlMap({
      target: ref.current,
      // view: new View({
      //   maxZoom: 22,
      //   center: fromLonLat([10, 51]),
      //   zoom: 5,
      // }),
    })

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

function LayerSwitcher({...options}) {
  const map = React.useContext(MapContext)

  const control = React.useMemo(() => new OlLayerSwitcher(options), [])

  React.useEffect(() => {
    map?.addControl(control)
    return () => map?.removeControl(control)
  }, [control, map])

  return null
}

Map.FitView = FitView
Map.GroupLayer = GroupLayer
Map.LayerSwitcher = LayerSwitcher
Map.TileLayer = TileLayer
Map.VectorLayer = VectorLayer
Map.View = View

export default Map
