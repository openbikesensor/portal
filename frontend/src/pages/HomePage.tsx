import React from 'react'
import {Grid, Loader, Header, Item} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {of, from} from 'rxjs'
import {map, switchMap} from 'rxjs/operators'
import {useTranslation} from 'react-i18next'

import api from 'api'
import {RegionStats, Stats, Page} from 'components'
import type {Track} from 'types'

import {TrackListItem, NoPublicTracksMessage} from './TracksPage'

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

  return (
    <>
      <Header as="h2">{t('HomePage.mostRecentTrack')}</Header>
      <Loader active={track === null} />
      {track === undefined ? (
        <NoPublicTracksMessage />
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
  )
}
