import React from 'react'
// import {Grid, Loader, Header, Item} from 'semantic-ui-react'

// import api from 'api'
import {Page} from 'components'
import {useConfig, Config} from 'config'

import styles from './MapPage.module.scss'

import 'ol/ol.css'
import {obsRoads} from '../mapstyles'
import ReactMapGl from 'react-map-gl'

function BigMap({mapSource, config}: {mapSource: string ,config: Config}) {
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
    <div className={styles.mapContainer}>
      <ReactMapGl mapStyle={mapStyle} width="100%" height="100%" onViewportChange={setViewport} {...viewport} />
    </div>
  )
}

export default function MapPage() {
  const config = useConfig() || {}
  if (!config) return null;
  const {obsMapSource: mapSource} = config

  if (!mapSource) return null;

  return (
    <Page fullScreen>
      <BigMap {...{mapSource, config}} />
    </Page>
  )
}
