import React, {useState, useCallback} from 'react'
import {Link} from 'react-router-dom'
import {Message, Grid, Loader, Statistic, Segment, Header, Item, Menu} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {of, from, concat} from 'rxjs'
import {tap, map, switchMap, distinctUntilChanged} from 'rxjs/operators'
import {fromLonLat} from 'ol/proj'
import {Duration, DateTime} from 'luxon'

import api from '../api'
import {Map, Page, RoadsLayer} from '../components'

import {TrackListItem} from './TracksPage'
import styles from './HomePage.module.scss'

function formatDuration(seconds) {
  return Duration.fromMillis((seconds ?? 0) * 1000)
    .as('hours')
    .toFixed(1) + ' h'
}

function WelcomeMap() {
  return (
    <Map className={styles.welcomeMap}>
      <RoadsLayer />
      <Map.TileLayer
        osm={{
          url: 'https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png',
          crossOrigin: null,
        }}
      />
      {/* <Map.View maxZoom={22} zoom={6} center={fromLonLat([10, 51])} /> */}
      <Map.View maxZoom={22} zoom={13} center={fromLonLat([9.1798, 48.7759])} />
    </Map>
  )
}

function Stats() {
  const [timeframe, setTimeframe] = useState('all_time')
  const onClick = useCallback((_e, {name}) => setTimeframe(name), [setTimeframe])

  const stats = useObservable(
    (_$, inputs$) =>
      inputs$.pipe(
        map((inputs) => inputs[0]),
        distinctUntilChanged(),
        map((timeframe_) => {
          const now = DateTime.now()

          switch (timeframe_) {
            case 'this_month':
              return {
                start: now.startOf('month').toISODate(),
                end: now.endOf('month').toISODate(),
              }
            case 'this_year':
              return {
                start: now.startOf('year').toISODate(),
                end: now.endOf('year').toISODate(),
              }
            case 'all_time':
            default:
              return {}
          }
        }),
        switchMap((query) => concat(of(null), from(api.get('/stats', {query})))),
        tap(console.log),
      ),
    null,
    [timeframe]
  )

  return (
    <>
      <Header as="h2">Statistics</Header>

      <div>
        <Segment attached="top">
          <Loader active={stats == null} />
          <Statistic.Group widths={2} size="tiny">
            <Statistic>
              <Statistic.Value>{stats ? `${Number(stats?.trackLength / 1000).toFixed(1)} km` : '...'}</Statistic.Value>
              <Statistic.Label>Total track length</Statistic.Label>
            </Statistic>
            <Statistic>
              <Statistic.Value>{stats ? formatDuration(stats?.trackDuration) : '...'}</Statistic.Value>
              <Statistic.Label>Time recorded</Statistic.Label>
            </Statistic>
            <Statistic>
              <Statistic.Value>{stats?.numEvents ?? '...'}</Statistic.Value>
              <Statistic.Label>Events confirmed</Statistic.Label>
            </Statistic>
            <Statistic>
              <Statistic.Value>{stats?.userCount ?? '...'}</Statistic.Value>
              <Statistic.Label>Members joined</Statistic.Label>
            </Statistic>
          </Statistic.Group>
        </Segment>

        <Menu widths={3} attached="bottom" size="small">
          <Menu.Item name="this_month" active={timeframe === 'this_month'} onClick={onClick}>
            This month
          </Menu.Item>
          <Menu.Item name="this_year" active={timeframe === 'this_year'} onClick={onClick}>
            This year
          </Menu.Item>
          <Menu.Item name="all_time" active={timeframe === 'all_time'} onClick={onClick}>
            All time
          </Menu.Item>
        </Menu>
      </div>
    </>
  )
}

function MostRecentTrack() {
  const track: Track | null = useObservable(
    () =>
      of(null).pipe(
        switchMap(() => from(api.fetch('/tracks?limit=1'))),
        map((response) => response?.tracks?.[0])
      ),
    null,
    []
  )

  return (
    <>
      <Header as="h2">Most recent track</Header>
      <Loader active={track === null} />
      {track === undefined ? (
        <Message>
          No public tracks yet. <Link to="/upload">Upload the first!</Link>
        </Message>
      ) : track ? (
        <Item.Group>
          <TrackListItem track={track} />
        </Item.Group>
      ) : null}
    </>
  )
}

export default function HomePage() {
  return (
    <Page>
      <Grid stackable>
        <Grid.Row>
          <Grid.Column width={10}>
            <WelcomeMap />
          </Grid.Column>
          <Grid.Column width={6}>
            <Stats />
            <MostRecentTrack />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Page>
  )
}
