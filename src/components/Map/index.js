import React from 'react'

import OlMap from 'ol/Map';
import View from 'ol/View';
import OlTileLayer from 'ol/layer/Tile';
import {fromLonLat} from 'ol/proj';
import OSM from 'ol/source/OSM';

import "ol/ol.css";


const MapContext = React.createContext()

export function Map({children, ...props}) {
  const ref = React.useRef()

  const [map, setMap] = React.useState(null)

  React.useLayoutEffect(() => {
    const map = new OlMap({
      target: ref.current,
      view: new View({
        maxZoom: 22,
        center: fromLonLat([10, 51]),
        zoom: 5
      })
    });

    setMap(map)

    return () => {
      map.setTarget(null)
      setMap(null)
    }
  }, [])

  return <>
    <div ref={ref} {...props}>
    <MapContext.Provider value={map}>
      {children}
    </MapContext.Provider>
    </div>
    </>
}

export function TileLayer() {
  const map = React.useContext(MapContext)

  const layer = React.useMemo(() => new OlTileLayer({
    source: new OSM()
  }), [])

  React.useEffect(() => {
    map?.addLayer(layer)
    return () => map?.removeLayer(layer)
  })
  return null

}

Map.TileLayer = TileLayer
export default Map;
