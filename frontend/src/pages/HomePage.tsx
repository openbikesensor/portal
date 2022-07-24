import React from 'react'
import {Link} from 'react-router-dom'
import {Message, Grid, Loader, Header, Item} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {of, from} from 'rxjs'
import {map, switchMap} from 'rxjs/operators'

import api from 'api'
import {Stats, Page, Map} from 'components'

import {TrackListItem} from './TracksPage'
import styles from './HomePage.module.less'

function MostRecentTrack() {
  const {t} = useTranslation()

  const track: Track | null = useObservable(
    () =>
      of(null).pipe(
        switchMap(() => from(api.fetch('/tracks?limit=1'))),
        map((response) => response?.tracks?.[0])
      ),
    null,
    []
  )

  const {t} = useTranslation()
  return (
    <>
      <Header as="h2">Most recent tracks</Header>
      <Loader active={tracks === null} />
      {tracks?.length === 0 ? (
        <Message>
          No public tracks yet. <Link to="/upload">Upload the first!</Link>
        </Message>
      ) : tracks ? (
        <Item.Group>
          {tracks.map((track) => (
            <TrackListItem key={track.id} track={track} />
          ))}
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
          <Grid.Column width={8}>
            <Stats />
          </Grid.Column>
          <Grid.Column width={8}>
            <MostRecentTrack />
            <RegionStats />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Page>
  )
}
