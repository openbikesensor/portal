import React from 'react'

import {Page} from 'components'
import {useConfig, Config} from 'config'
import ReactMapGl, {AttributionControl } from 'react-map-gl'

import styles from './MapPage.module.scss'

import {obsRoads, basemap } from '../mapstyles'

function CustomMapInner({mapSource, config, mode, children}: {mapSource: string, config: Config, mode?: 'roads'}) {
  const mapStyle = React.useMemo(() => {
    if (mode === 'roads') {
      return mapSource && obsRoads(mapSource)
    } else {
      return basemap
    }
  }, [mapSource, mode])

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
        '<a href="https://openstreetmap.org/copyright" target="_blank" rel="nofollow noopener noreferrer">© OpenStreetMap contributors</a>',
        '<a href="https://openmaptiles.org/" target="_blank" rel="nofollow noopener noreferrer">© OpenMapTiles</a>',
        '<a href="https://openbikesensor.org/" target="_blank" rel="nofollow noopener noreferrer">© OpenBikeSensor</a>',
      ]} />

      {children}
    </ReactMapGl>
  )
}

export function CustomMap(props) {
  const config = useConfig() || {}
  if (!config) return null;
  const {obsMapSource: mapSource} = config

  if (!mapSource) return null;

  return (
    <CustomMapInner {...{mapSource, config}} {...props} />
  )
}

export default function MapPage() {
  return (
    <Page fullScreen>
      <div className={styles.mapContainer}>
        <CustomMap mode='roads' />
      </div>
    </Page>
  )
}
