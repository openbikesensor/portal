import React, {useState, useCallback, useMemo, useEffect} from 'react'
import classnames from 'classnames'
import {connect} from 'react-redux'
import _ from 'lodash'
import ReactMapGl, {WebMercatorViewport, ScaleControl, NavigationControl} from 'react-map-gl'
import turfBbox from '@turf/bbox'
import {useHistory, useLocation} from 'react-router-dom'

import {useConfig} from 'config'

import {baseMapStyles} from '../../mapstyles'

import styles from './styles.module.less'

interface Viewport {
  longitude: number
  latitude: number
  zoom: number
}
const EMPTY_VIEWPORT: Viewport = {longitude: 0, latitude: 0, zoom: 0}

export const withBaseMapStyle = connect((state) => ({baseMapStyle: state.mapConfig?.baseMap?.style ?? 'positron'}))

function parseHash(v: string): Viewport | null {
  if (!v) return null
  const m = v.match(/^#([0-9\.]+)\/([0-9\.]+)\/([0-9\.]+)$/)
  if (!m) return null
  return {
    zoom: Number.parseFloat(m[1]),
    latitude: Number.parseFloat(m[2]),
    longitude: Number.parseFloat(m[3]),
  }
}

function buildHash(v: Viewport): string {
  return `${v.zoom.toFixed(2)}/${v.latitude}/${v.longitude}`
}

function useViewportFromUrl(): [Viewport | null, (v: Viewport) => void] {
  const history = useHistory()
  const location = useLocation()
  const value = useMemo(() => parseHash(location.hash), [location.hash])
  const setter = useCallback(
    (v) => {
      history.replace({
        hash: buildHash(v),
      })
    },
    [history]
  )
  return [value || EMPTY_VIEWPORT, setter]
}

function Map({
  viewportFromUrl,
  children,
  boundsFromJson,
  baseMapStyle,
  ...props
}: {
  viewportFromUrl?: boolean
  children: React.ReactNode
  boundsFromJson: GeoJSON.Geometry
  baseMapStyle: string
}) {
  const [viewportState, setViewportState] = useState(EMPTY_VIEWPORT)
  const [viewportUrl, setViewportUrl] = useViewportFromUrl()

  const [viewport, setViewport] = viewportFromUrl ? [viewportUrl, setViewportUrl] : [viewportState, setViewportState]

  const config = useConfig()
  useEffect(() => {
    if (config?.mapHome && viewport?.latitude === 0 && viewport?.longitude === 0 && !boundsFromJson) {
      setViewport(config.mapHome)
    }
  }, [config, boundsFromJson])

  useEffect(() => {
    if (boundsFromJson) {
      const bbox = turfBbox(boundsFromJson);
      if (bbox.every(v => Math.abs(v) !== Infinity)) {
        const [minX, minY, maxX, maxY] = bbox;
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
    }
  }, [boundsFromJson])

  return (
    <ReactMapGl
      mapStyle={baseMapStyles[baseMapStyle]}
      width="100%"
      height="100%"
      onViewportChange={setViewport}
      {...viewport}
      {...props}
      className={classnames(styles.map, props.className)}
    >
      <NavigationControl style={{left: 10, top: 10}} />
      <ScaleControl maxWidth={200} unit="metric" style={{left: 10, bottom: 10}} />

      {children}
    </ReactMapGl>
  )
}

export default withBaseMapStyle(Map)
