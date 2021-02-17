import _ from 'lodash'
import React from 'react'
import {connect} from 'react-redux'
import {Message, Grid, Loader, Statistic, Segment, Header, Item} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {of, pipe, from} from 'rxjs'
import {map, switchMap, distinctUntilChanged} from 'rxjs/operators'
import {Duration} from 'luxon'

import api from '../api'
import {Map, Page, LoginForm} from '../components'

import {TrackListItem} from './TracksPage'

function formatDuration(seconds) {
  return Duration.fromMillis((seconds ?? 0) * 1000)
    .as('hours')
    .toFixed(1)
}

function WelcomeMap() {
  return (
    <Map style={{height: '24rem'}}>
      <Map.TileLayer />
    </Map>
  )
}

function Stats() {
  const stats = useObservable(
    pipe(
      distinctUntilChanged(_.isEqual),
      switchMap(() => api.fetch('/stats'))
    )
  )

  return (
    <>
      <Header as="h2">Statistics</Header>

      <Segment>
        <Loader active={stats == null} />

        <Statistic.Group widths={4} size="tiny">
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

const LoginState = connect((state) => ({login: state.login}))(function LoginState({login}) {
  return login ? (
    <>
      <Header as="h2">Logged in as {login.username} </Header>
    </>
  ) : (
    <>
      <Header as="h2">Login</Header>
      <LoginForm />
    </>
  )
})

function MostRecentTrack() {
  const track: Track | null = useObservable(
    () =>
      of(null).pipe(
        switchMap(() => from(api.fetch('/tracks?limit=1'))),
        map(({tracks}) => tracks[0])
      ),
    null,
    []
  )

  console.log(track)

  return (
    <>
      <h2>Most recent track</h2>
      <Loader active={track === null} />
      {track === undefined ? (
        <Message>No track uploaded yet. Be the first!</Message>
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
      <Grid>
        <Grid.Row>
          <Grid.Column width={16}>
            <WelcomeMap />
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column width={10}>
            <Stats />
            <MostRecentTrack />
          </Grid.Column>
          <Grid.Column width={6}>
            <LoginState />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Page>
  )
}
