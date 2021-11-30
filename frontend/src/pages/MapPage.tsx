import React from 'react'
import _ from 'lodash'
import {Segment, List, Header, Label, Icon, Table} from 'semantic-ui-react'
import ReactMapGl, {WebMercatorViewport, AttributionControl, NavigationControl, Layer, Source} from 'react-map-gl'
import turfBbox from '@turf/bbox'
import {useHistory, useLocation} from 'react-router-dom'
import {of, from, concat} from 'rxjs'
import {useObservable} from 'rxjs-hooks'
import {switchMap, distinctUntilChanged} from 'rxjs/operators'

import {Page} from 'components'
import {useConfig, Config} from 'config'

import {roadsLayer, basemap} from '../mapstyles'

import styles from './MapPage.module.less'

const EMPTY_VIEWPORT = {longitude: 0, latitude: 0, zoom: 0}

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
  ...props
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
    if (config?.mapHome && viewport.latitude === 0 && viewport.longitude === 0 && !boundsFromJson) {
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
    <ReactMapGl mapStyle={basemap} width="100%" height="100%" onViewportChange={setViewport} {...viewport} {...props}>
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

function CurrentRoadInfo({clickLocation}) {
  const info = useObservable(
    (_$, inputs$) =>
      inputs$.pipe(
        distinctUntilChanged(_.isEqual),
        switchMap(([location]) =>
          location
            ? concat(
                of(null),
                from(
                  api.get('/mapdetails/road', {
                    query: {
                      ...location,
                      radius: 100,
                    },
                  })
                )
              )
            : of(null)
        )
      ),
    null,
    [clickLocation]
  )

  if (!clickLocation) {
    return null
  }

  const loading = info == null

  const content =
    !loading && !info.road ? (
      'No road found.'
    ) : (
      <>
        <Header as="h1">{loading ? '...' : info?.road.name || 'Unnamed way'}</Header>

        <List>
          <List.Item>
            <List.Header>Zone</List.Header>
            {info?.road.zone}
          </List.Item>
          <List.Item>
            <List.Header>Tags</List.Header>
            {info?.road.oneway && (
              <Label size="small" color="blue">
                <Icon name="long arrow alternate right" fitted /> oneway
              </Label>
            )}
          </List.Item>

            <List.Item>
              <List.Header>Statistics</List.Header>
              <Table size='small' compact>
                <Table.Header>
                <Table.Row><Table.HeaderCell></Table.HeaderCell>
                  <Table.HeaderCell>n</Table.HeaderCell>
                  <Table.HeaderCell>min</Table.HeaderCell>
                  <Table.HeaderCell>q50</Table.HeaderCell>
                  <Table.HeaderCell>max</Table.HeaderCell>
                  <Table.HeaderCell>mean</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
                <Table.Body>
                  {['distanceOvertaker', 'distanceStationary', 'speed'].map(prop => <Table.Row key={prop}>
                  <Table.Cell>{prop}</Table.Cell>
                  {['count', 'min', 'median', 'max', 'mean'].map(stat => <Table.Cell key={stat}>{info?.[prop]?.statistics?.[stat]?.toFixed(3)}</Table.Cell>)}
                </Table.Row>)}
              </Table.Body>
              </Table>
          </List.Item>
        </List>
      </>
    )

  return (
    <>
      {info?.road && (
        <Source id="highlight" type="geojson" data={info.road.geometry}>
          <Layer
            id="route"
            type="line"
            paint={{
              'line-width': ['interpolate', ['linear'], ['zoom'], 14, 6, 17, 12],
              'line-color': '#18FFFF',
              'line-opacity': 0.8,
            }}
          />
        </Source>
      )}

      {content && (
        <div className={styles.mapInfoBox}>
          <Segment loading={loading}>{content}</Segment>
        </div>
      )}
    </>
  )
}

export default function MapPage() {
  const {obsMapSource} = useConfig() || {}
  const [clickLocation, setClickLocation] = React.useState<{longitude: number; latitude: number} | null>(null)

  const onClick = React.useCallback(
    (e) => {
      setClickLocation({longitude: e.lngLat[0], latitude: e.lngLat[1]})
    },
    [setClickLocation]
  )

  if (!obsMapSource) {
    return null
  }

  return (
    <Page fullScreen>
      <div className={styles.mapContainer}>
        <CustomMap viewportFromUrl onClick={onClick}>
          <Source id="obs" {...obsMapSource}>
            <Layer {...roadsLayer} />
          </Source>

          <CurrentRoadInfo {...{clickLocation}} />
        </CustomMap>
      </div>
    </Page>
  )
}
