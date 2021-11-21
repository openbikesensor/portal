import React from 'react'
// import {Grid, Loader, Header, Item} from 'semantic-ui-react'

// import api from 'api'
import {Page} from 'components'
import {useConfig, Config} from 'config'

import styles from './MapPage.module.scss'

import 'ol/ol.css'
import {obsRoads} from '../mapstyles'
import ReactMapGl, {AttributionControl } from 'react-map-gl'

function RoadsMapInner({mapSource, config}: {mapSource: string ,config: Config}) {
  const mapStyle = React.useMemo(() => mapSource && obsRoads(mapSource), [mapSource])
  const [viewport, setViewport] = React.useState({
    longitude: 0,
    latitude: 0,
    zoom: 0,
  })

  React.useEffect(() => {
    if (config?.mapHome) {
      setViewport(config.mapHome)
    }
  }, [config])

  if (!mapStyle) {
    return null
  }

  return (
    <ReactMapGl mapStyle={mapStyle} width="100%" height="100%" onViewportChange={setViewport} {...viewport}>
      <AttributionControl style={{right: 0, bottom: 0}} customAttribution={[
        '<a href="https://openstreetmap.org/copyright" target="_blank" rel="nofollow noopener">© OpenStreetMap contributors</a>',
        '<a href="https://openmaptiles.org/" target="_blank" rel="nofollow noopener">© OpenMapTiles</a>',
        '<a href="https://openbikesensor.org/" target="_blank" rel="nofollow noopener">© OpenBikeSensor</a>',
      ]} />
    </ReactMapGl>
  )
}

export function RoadsMap(props) {
  const config = useConfig() || {}
  if (!config) return null;
  const {obsMapSource: mapSource} = config

  if (!mapSource) return null;

  return (
    <RoadsMapInner {...{mapSource, config}} {...props} />
  )
}

export default function MapPage() {
  return (
    <Page fullScreen>
      <div className={styles.mapContainer}>
        <RoadsMap />
      </div>
    </Page>
  )
}
