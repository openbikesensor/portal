import React from 'react'
import {Link} from 'react-router-dom'
import {Message, Grid, Loader, Statistic, Segment, Header, Item} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {of, from} from 'rxjs'
import {map, switchMap} from 'rxjs/operators'
import {fromLonLat} from 'ol/proj'
import {Duration} from 'luxon'

import api from '../api'
import {Map, Page} from '../components'

import {TrackListItem} from './TracksPage'
import styles from './HomePage.module.scss'

function formatDuration(seconds) {
  return Duration.fromMillis((seconds ?? 0) * 1000)
    .as('hours')
    .toFixed(1)
}

function WelcomeMap() {
  return (
    <Map className={styles.welcomeMap}>
      <Map.TileLayer />
      <Map.View maxZoom={22} zoom={6} center={fromLonLat([10, 51])} />
    </Map>
  )
}

function Stats() {
  const stats = useObservable(
    () => of(null).pipe(
      switchMap(() => api.fetch('/stats'))
    ),
  )

  return (
    <>
      <Header as="h2">Statistics</Header>

      <Segment>
        <Loader active={stats == null} />

        <Statistic.Group widths={2} size="mini" >
          <Statistic>
            <Statistic.Value>{Number(stats?.publicTrackLength / 1000).toFixed(1)}</Statistic.Value>
            <Statistic.Label>km track length</Statistic.Label>
          </Statistic>
          <Statistic>
            <Statistic.Value>{formatDuration(stats?.trackDuration)}</Statistic.Value>
            <Statistic.Label>hrs recorded</Statistic.Label>
          </Statistic>
          <Statistic>
            <Statistic.Value>{stats?.numEvents}</Statistic.Value>
            <Statistic.Label>events</Statistic.Label>
          </Statistic>
          <Statistic>
            <Statistic.Value>{stats?.userCount}</Statistic.Value>
            <Statistic.Label>members</Statistic.Label>
          </Statistic>
        </Statistic.Group>
      </Segment>
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
      <h2>Most recent track</h2>
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
