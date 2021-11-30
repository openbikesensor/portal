import React from 'react'

import {Page} from 'components'
import {useConfig, Config} from 'config'
import {useHistory, useLocation} from 'react-router-dom'
import ReactMapGl, {AttributionControl } from 'react-map-gl'

import styles from './MapPage.module.less'

import {obsRoads, basemap } from '../mapstyles'

function parseHash(v) {
  if (!v) return null
  const m = v.match(/^#([0-9\.]+)\/([0-9\.]+)\/([0-9\.]+)$/)
  if (!m) return null
    return {
      zoom: Number.parseFloat(m[1]),
      latitude: Number.parseFloat(m[2]),
      longitude: Number.parseFloat(m[3]),
    }
}
const EMPTY_VIEWPORT = {longitude: 0, latitude: 0, zoom: 0}

function buildHash(v) {
  return `${v.zoom.toFixed(2)}/${v.latitude}/${v.longitude}`
}

function useViewportFromUrl() {
  const history = useHistory()
  const location = useLocation()
  const value = React.useMemo(() => parseHash(location.hash), [location.hash])
  const setter = React.useCallback((v) => {
    history.replace({
      hash: buildHash(v)
    })
  }, [history])
  return [value || EMPTY_VIEWPORT, setter]
}

function CustomMapInner({viewportFromUrl, mapSource, config, mode, children}: {viewportFromUrl?: boolean, mapSource: string, config: Config, mode?: 'roads'}) {
  const mapStyle = React.useMemo(() => {
    if (mode === 'roads') {
      return mapSource && obsRoads(mapSource)
    } else {
      return basemap
    }
  }, [mapSource, mode])

  const [viewportState, setViewportState] = React.useState(EMPTY_VIEWPORT)
  const [viewportUrl, setViewportUrl] = useViewportFromUrl()

  const [viewport, setViewport] = viewportFromUrl ? [viewportUrl, setViewportUrl] : [viewportState, setViewportState]

  React.useEffect(() => {
    if (config?.mapHome && viewport.zoom === 0) {
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
        <CustomMap mode='roads' viewportFromUrl />
      </div>
    </Page>
  )
}
