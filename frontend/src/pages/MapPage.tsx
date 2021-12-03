import React, {useState, useCallback, useMemo, useEffect} from 'react'
import _ from 'lodash'
import {Segment, Menu, Header, Label, Icon, Table} from 'semantic-ui-react'
import ReactMapGl, {WebMercatorViewport, AttributionControl, NavigationControl, Layer, Source} from 'react-map-gl'
import turfBbox from '@turf/bbox'
import {useHistory, useLocation} from 'react-router-dom'
import {of, from, concat} from 'rxjs'
import {useObservable} from 'rxjs-hooks'
import {switchMap, distinctUntilChanged} from 'rxjs/operators'

import {Page} from 'components'
import {useConfig} from 'config'
import api from 'api'

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
  const [viewportState, setViewportState] = useState(EMPTY_VIEWPORT)
  const [viewportUrl, setViewportUrl] = useViewportFromUrl()

  const [viewport, setViewport] = viewportFromUrl ? [viewportUrl, setViewportUrl] : [viewportState, setViewportState]

  const config = useConfig()
  useEffect(() => {
    if (config?.mapHome && viewport.latitude === 0 && viewport.longitude === 0 && !boundsFromJson) {
      setViewport(config.mapHome)
    }
  }, [config, boundsFromJson])

  useEffect(() => {
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

const UNITS = {distanceOvertaker: 'm', distanceStationary: 'm', speed: 'm/s'}
const LABELS = {distanceOvertaker: 'Overtaker', distanceStationary: 'Stationary', speed: 'Speed'}
const ZONE_COLORS = {urban: 'olive', rural: 'brown', motorway: 'purple'}
const CARDINAL_DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
const getCardinalDirection = (bearing) =>
  bearing == null
    ? 'unknown'
    : CARDINAL_DIRECTIONS[
        Math.floor(((bearing / 360.0) * CARDINAL_DIRECTIONS.length + 0.5) % CARDINAL_DIRECTIONS.length)
      ] + ' bound'

function RoadStatsTable({data}) {
  return (
    <Table size="small" compact>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Property</Table.HeaderCell>
          <Table.HeaderCell>n</Table.HeaderCell>
          <Table.HeaderCell>min</Table.HeaderCell>
          <Table.HeaderCell>q50</Table.HeaderCell>
          <Table.HeaderCell>max</Table.HeaderCell>
          <Table.HeaderCell>mean</Table.HeaderCell>
          <Table.HeaderCell>unit</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {['distanceOvertaker', 'distanceStationary', 'speed'].map((prop) => (
          <Table.Row key={prop}>
            <Table.Cell>{LABELS[prop]}</Table.Cell>
            {['count', 'min', 'median', 'max', 'mean'].map((stat) => (
              <Table.Cell key={stat}>{data[prop]?.statistics?.[stat]?.toFixed(stat === 'count' ? 0 : 3)}</Table.Cell>
            ))}
            <Table.Cell>{UNITS[prop]}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  )
}

function CurrentRoadInfo({clickLocation}) {
  const [direction, setDirection] = useState('forwards')

  const onClickDirection = useCallback(
    (e, {name}) => {
      e.preventDefault()
      e.stopPropagation()
      setDirection(name)
    },
    [setDirection]
  )

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

  const offsetDirection = info?.road.oneway ? 0 : direction === 'forwards' ? 1 : -1; // TODO: change based on left-hand/right-hand traffic

  const content =
    !loading && !info.road ? (
      'No road found.'
    ) : (
      <>
        <Header as="h3">{loading ? '...' : info?.road.name || 'Unnamed way'}</Header>

        {info?.road.zone && (
          <Label size="small" color={ZONE_COLORS[info?.road.zone]}>
            {info?.road.zone}
          </Label>
        )}

        {info?.road.oneway && (
          <Label size="small" color="blue">
            <Icon name="long arrow alternate right" fitted /> oneway
          </Label>
        )}

        {info?.road.oneway ? null : (
          <Menu size="tiny" fluid secondary>
            <Menu.Item header>Direction</Menu.Item>
            <Menu.Item name="forwards" active={direction === 'forwards'} onClick={onClickDirection}>
              {getCardinalDirection(info?.forwards?.bearing)}
            </Menu.Item>
            <Menu.Item name="backwards" active={direction === 'backwards'} onClick={onClickDirection}>
              {getCardinalDirection(info?.backwards?.bearing)}
            </Menu.Item>
          </Menu>
        )}

        {info?.[direction] && <RoadStatsTable data={info[direction]} />}
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
              'line-opacity': 0.5,
              ...({
                'line-offset': [
                  'interpolate',
                  ['exponential', 1.5],
                  ['zoom'],
                  12,
                  offsetDirection,
                  19,
                  offsetDirection * 8,
                ],
              })

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
  const [clickLocation, setClickLocation] = useState<{longitude: number; latitude: number} | null>(null)

  const onClick = useCallback(
    (e) => {
      let node = e.target
      while (node) {
        if (node?.classList?.contains(styles.mapInfoBox)) {
          return
        }
        node = node.parentNode
      }

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
