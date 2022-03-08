import React, {useState, useCallback} from 'react'
import _ from 'lodash'
import {Segment, Menu, Header, Label, Icon, Table} from 'semantic-ui-react'
import {Layer, Source} from 'react-map-gl'
import {of, from, concat} from 'rxjs'
import {useObservable} from 'rxjs-hooks'
import {switchMap, distinctUntilChanged} from 'rxjs/operators'

import api from 'api'

import styles from './styles.module.less'

const UNITS = {distanceOvertaker: 'm', distanceStationary: 'm', speed: 'km/h'}
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
              <Table.Cell key={stat}>{((data[prop]?.statistics?.[stat]) * (prop === `speed` ? 3.6 : 1)).toFixed(stat === 'count' ? 0 : 2)}</Table.Cell>
            ))}
            <Table.Cell>{UNITS[prop]}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  )
}

export default function RoadInfo({clickLocation}) {
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

  const offsetDirection = info?.road?.oneway ? 0 : direction === 'forwards' ? 1 : -1 // TODO: change based on left-hand/right-hand traffic

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
              ...{
                'line-offset': [
                  'interpolate',
                  ['exponential', 1.5],
                  ['zoom'],
                  12,
                  offsetDirection,
                  19,
                  offsetDirection * 8,
                ],
              },
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
