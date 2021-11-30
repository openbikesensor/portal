import React from 'react'

import ReactMapGl, {WebMercatorViewport, AttributionControl, NavigationControl, Layer, Source} from 'react-map-gl'
import turfBbox from '@turf/bbox'

import {Page} from 'components'
import {useConfig, Config} from 'config'
import {useHistory, useLocation} from 'react-router-dom'

import styles from './MapPage.module.less'

import {roadsLayer, basemap} from '../mapstyles'

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
  const setter = React.useCallback(
    (v) => {
      history.replace({
        hash: buildHash(v),
      })
    },
    [history]
  )
  return [value || EMPTY_VIEWPORT, setter]
}

export function CustomMap({
  viewportFromUrl,
  children,
  boundsFromJson,
}: {
  viewportFromUrl?: boolean
  children: React.ReactNode
  boundsFromJson: GeoJSON.Geometry
}) {
  const [viewportState, setViewportState] = React.useState(EMPTY_VIEWPORT)
  const [viewportUrl, setViewportUrl] = useViewportFromUrl()

  const [viewport, setViewport] = viewportFromUrl ? [viewportUrl, setViewportUrl] : [viewportState, setViewportState]

  const config = useConfig()
  React.useEffect(() => {
    if (config?.mapHome && viewport.zoom === 0 && !boundsFromJson) {
      setViewport(config.mapHome)
    }
  }, [config, boundsFromJson])

  React.useEffect(() => {
    if (boundsFromJson) {
      const [minX, minY, maxX, maxY] = turfBbox(boundsFromJson)
      const vp = new WebMercatorViewport({width: 1000, height: 800}).fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        {
          padding: 20,
          offset: [0, -100],
        }
      )
      setViewport(_.pick(vp, ['zoom', 'latitude', 'longitude']))
    }
  }, [boundsFromJson])

  return (
    <ReactMapGl mapStyle={basemap} width="100%" height="100%" onViewportChange={setViewport} {...viewport}>
      <AttributionControl
        style={{right: 0, bottom: 0}}
        customAttribution={[
          '<a href="https://openstreetmap.org/copyright" target="_blank" rel="nofollow noopener noreferrer">© OpenStreetMap contributors</a>',
          '<a href="https://openmaptiles.org/" target="_blank" rel="nofollow noopener noreferrer">© OpenMapTiles</a>',
          '<a href="https://openbikesensor.org/" target="_blank" rel="nofollow noopener noreferrer">© OpenBikeSensor</a>',
        ]}
      />
      <NavigationControl style={{left: 10, top: 10}} />

      {children}
    </ReactMapGl>
  )
}

export function RoadsMap() {
  const {obsMapSource} = useConfig() || {}

  if (!obsMapSource) {
    return null
  }

  return (
    <CustomMap viewportFromUrl>
      <Source id="obs" {...obsMapSource}>
        <Layer {...roadsLayer} />
      </Source>
    </CustomMap>
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
