import React, {useState, useCallback} from 'react'
import {createPortal} from 'react-dom'
import _ from 'lodash'
import {Segment, Menu, Header, Label, Icon, Table, Message, Button} from 'semantic-ui-react'
import {Layer, Source} from 'react-map-gl'
import {of, from, concat} from 'rxjs'
import {useObservable} from 'rxjs-hooks'
import {switchMap, distinctUntilChanged} from 'rxjs/operators'
import {Chart} from 'components'
import {pairwise} from 'utils'
import {useTranslation} from 'react-i18next'

import type {Location} from 'types'
import api from 'api'
import {colorByDistance, borderByZone} from 'mapstyles'

import styles from './styles.module.less'

function selectFromColorMap(colormap, value) {
  let last = null
  for (let i = 0; i < colormap.length; i += 2) {
    if (colormap[i + 1] > value) {
      return colormap[i]
    }
  }
  return colormap[colormap.length - 1]
}

const UNITS = {
  distanceOvertaker: 'm',
  distanceStationary: 'm',
  speed: 'km/h',
}
const ZONE_COLORS = {urban: 'blue', rural: 'cyan', motorway: 'purple'}
const CARDINAL_DIRECTIONS = ['north', 'northEast', 'east', 'southEast', 'south', 'southWest', 'west', 'northWest']
const getCardinalDirection = (t, bearing) => {
  if (bearing == null) {
    return t('MapPage.roadInfo.cardinalDirections.unknown')
  } else {
    const n = CARDINAL_DIRECTIONS.length
    const i = Math.floor(((bearing / 360.0) * n + 0.5) % n)
    const name = CARDINAL_DIRECTIONS[i]
    return t(`MapPage.roadInfo.cardinalDirections.${name}`)
  }
}

function RoadStatsTable({data}) {
  const {t} = useTranslation()
  return (
    <Table size="small" compact>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell textAlign="right"></Table.HeaderCell>
          {['distanceOvertaker', 'distanceStationary', 'speed'].map((prop) => (
            <Table.HeaderCell key={prop} textAlign="right">
              {t(`MapPage.roadInfo.${prop}`)}
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {['count', 'min', 'median', 'max', 'mean'].map((stat) => (
          <Table.Row key={stat}>
            <Table.Cell> {t(`MapPage.roadInfo.${stat}`)}</Table.Cell>
            {['distanceOvertaker', 'distanceStationary', 'speed'].map((prop) => (
              <Table.Cell key={prop} textAlign="right">
                {(data[prop]?.statistics?.[stat] * (prop === `speed` && stat != 'count' ? 3.6 : 1)).toFixed(
                  stat === 'count' ? 0 : 2
                )}
                {stat !== 'count' && ` ${UNITS[prop]}`}
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  )
}

function HistogramChart({bins, counts, zone}) {
  const diff = bins[1] - bins[0]
  const colortype = zone === 'rural' ? 3 : 5
  const data = _.zip(
    bins.slice(0, bins.length - 1).map((v) => v + diff / 2),
    counts
  ).map((value) => ({
    value,
    itemStyle: {
      color: selectFromColorMap(colorByDistance()[3][colortype].slice(2), value[0]),
    },
  }))

  return (
    <Chart
      style={{height: 240}}
      option={{
        grid: {top: 30, bottom: 30, right: 30, left: 30},
        xAxis: {
          type: 'value',
          axisLabel: {formatter: (v) => `${Math.round(v * 100)} cm`},
          min: 0,
          max: 2.5,
        },
        yAxis: {},
        series: [
          {
            type: 'bar',
            data,

            barMaxWidth: 20,
          },
        ],
      }}
    />
  )
}

interface ArrayStats {
  statistics: {
    count: number
    mean: number
    min: number
    max: number
    median: number
  }
  histogram: {
    bins: number[]
    counts: number[]
    zone: string
  }
  values: number[]
}

export interface RoadDirectionInfo {
  bearing: number
  distanceOvertaker: ArrayStats
  distanceStationary: ArrayStats
  speed: ArrayStats
  below_150: number,
  roadUsage: number,
  count: number
}

export interface RoadInfoType {
  road: {
    way_id: number
    zone: 'urban' | 'rural' | null
    name: string
    directionality: -1 | 0 | 1
    oneway: boolean
    geometry: Object
  }
  forwards: RoadDirectionInfo
  backwards: RoadDirectionInfo
}

export default function RoadInfo({
  roadInfo: info,
  hasFilters,
  onClose,
  mapInfoPortal,
}: {
  roadInfo: RoadInfoType
  hasFilters: boolean
  onClose: () => void
  mapInfoPortal: HTMLElement
}) {
  const {t} = useTranslation()
  const [direction, setDirection] = useState('forwards')

  const onClickDirection = useCallback(
    (e, {name}) => {
      e.preventDefault()
      e.stopPropagation()
      setDirection(name)
    },
    [setDirection]
  )

  // TODO: change based on left-hand/right-hand traffic
  const offsetDirection = info.road.oneway ? 0 : direction === 'forwards' ? 1 : -1

  const content = (
    <>
      <div className={styles.closeHeader}>
        <Header as="h3">{info?.road.name || t('MapPage.roadInfo.unnamedWay')}</Header>
        <Button primary icon onClick={onClose}>
          <Icon name="close" />
        </Button>
      </div>

      {hasFilters && (
        <Message info icon>
          <Icon name="info circle" small />
          <Message.Content>{t('MapPage.roadInfo.hintFiltersNotApplied')}</Message.Content>
        </Message>
      )}

      {info?.road.zone && (
        <Label size="small" color={ZONE_COLORS[info?.road.zone]}>
          {t(`general.zone.${info.road.zone}`)}
        </Label>
      )}
      <Label>{Math.round(info.length)}m</Label>
      {info?.road.oneway && (
        <Label size="small" color="blue">
          <Icon name="long arrow alternate right" fitted /> {t('MapPage.roadInfo.oneway')}
        </Label>
      )}

      {info?.road.oneway ? null : (
        <Menu size="tiny" pointing>
          <Menu.Item header>{t('MapPage.roadInfo.direction')}</Menu.Item>
          <Menu.Item name="forwards" active={direction === 'forwards'} onClick={onClickDirection}>
            {getCardinalDirection(t, info?.forwards?.bearing)}
          </Menu.Item>
          <Menu.Item name="backwards" active={direction === 'backwards'} onClick={onClickDirection}>
            {getCardinalDirection(t, info?.backwards?.bearing)}
          </Menu.Item>
        </Menu>
      )}

      {info?.[direction] && <Label>{Math.round(100*info[direction].below_150/info[direction].count)}% {t(`MapPage.roadInfo.closeOvertakerPercentage`)} ({info[direction].below_150}/{info[direction].count}) </Label>}
      {info?.[direction] && <Label>{(1000*info[direction].below_150/(info.length*info[direction].roadUsage)).toFixed(1)} {t(`MapPage.roadInfo.closeOvertakerPercentage`)}/km </Label>}
      {info?.[direction] && <Label>roadUsage {info[direction].roadUsage} </Label>}


      {info?.[direction] && <RoadStatsTable data={info[direction]} />}

      {info?.[direction]?.distanceOvertaker?.histogram && (
        <>
          <Header as="h5">{t('MapPage.roadInfo.overtakerDistanceDistribution')}</Header>
          <HistogramChart {...info[direction]?.distanceOvertaker?.histogram} />
        </>
      )}
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

      {content && mapInfoPortal && createPortal(<div className={styles.mapInfoBox}>{content}</div>, mapInfoPortal)}
    </>
  )
}
