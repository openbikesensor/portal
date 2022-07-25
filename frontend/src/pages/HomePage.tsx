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

  const tracks: Track[] | null = useObservable(
    () =>
      of(null).pipe(
        switchMap(() => from(api.fetch("/tracks?limit=3"))),
        map((response) => response?.tracks)
      ),
    null,
    []
  );

  return (
    <>
      <Header as="h2">{t('HomePage.mostRecentTrack')}</Header>
      <Loader active={track === null} />
      {track === undefined ? (
        <NoPublicTracksMessage />
      ) : track ? (
        <Item.Group>
          {tracks.map((track) => (
            <TrackListItem key={track.id} track={track} />
          ))}
        </Item.Group>
      ) : null}
    </>
  );
}

export default function HomePage() {
  return (
    <Page>
      <Grid stackable>
        <Grid.Row>
          <Grid.Column width={8}>
            <Stats />
            <MostRecentTrack />
          </Grid.Column>
          <Grid.Column width={8}>
            <RegionStats />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Page>
  );
}
