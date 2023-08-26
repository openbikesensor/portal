import React, {useCallback} from 'react'
import {connect} from 'react-redux'
import {Button, Message, Item, Header, Loader, Pagination, Icon} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {Link} from 'react-router-dom'
import {of, from, concat} from 'rxjs'
import {map, switchMap, distinctUntilChanged} from 'rxjs/operators'
import _ from 'lodash'
import {useTranslation, Trans as Translate} from 'react-i18next'

import type {Track} from 'types'
import {Avatar, Page, StripMarkdown, FormattedDate, Visibility} from 'components'
import api from 'api'
import {useQueryParam} from 'query'

function TrackList({privateTracks}: {privateTracks: boolean}) {
  const [page, setPage] = useQueryParam<number>('page', 1, Number)

  const pageSize = 10

  const data: {
    tracks: Track[]
    trackCount: number
  } | null = useObservable(
    (_$, inputs$) =>
      inputs$.pipe(
        map(([page, privateTracks]) => {
          const url = '/tracks' + (privateTracks ? '/feed' : '')
          const query = {limit: pageSize, offset: pageSize * (page - 1)}
          return {url, query}
        }),
        distinctUntilChanged(_.isEqual),
        switchMap((request) => concat(of(null), from(api.get(request.url, {query: request.query}))))
      ),
    null,
    [page, privateTracks]
  )

  const {tracks, trackCount} = data || {tracks: [], trackCount: 0}
  const loading = !data
  const totalPages = Math.ceil(trackCount / pageSize)
  const {t} = useTranslation()

  return (
    <div>
      <Loader content={t('general.loading')} active={loading} />
      {!loading && totalPages > 1 && (
        <Pagination
          activePage={page}
          onPageChange={(e, data) => setPage(data.activePage as number)}
          totalPages={totalPages}
        />
      )}

      {tracks && tracks.length ? (
        <Item.Group divided>
          {tracks.map((track: Track) => (
            <TrackListItem key={track.slug} {...{track, privateTracks}} />
          ))}
        </Item.Group>
      ) : (
        <NoPublicTracksMessage />
      )}
    </div>
  )
}

export function NoPublicTracksMessage() {
  return (
    <Message>
      <Translate i18nKey="TracksPage.noPublicTracks">
        No public tracks yet. <Link to="/upload">Upload the first!</Link>
      </Translate>
    </Message>
  )
}

function maxLength(t: string | null, max: number): string | null {
  if (t && t.length > max) {
    return t.substring(0, max) + ' ...'
  } else {
    return t
  }
}

const COLOR_BY_STATUS = {
  error: 'red',
  complete: 'green',
  created: 'gray',
  queued: 'orange',
  processing: 'orange',
}

export function TrackListItem({track, privateTracks = false}) {
  const {t} = useTranslation()

  return (
    <Item key={track.slug}>
      <Item.Image size="tiny">
        <Avatar user={track.author} />
      </Item.Image>
      <Item.Content>
        <Item.Header as={Link} to={`/tracks/${track.slug}`}>
          {track.title || t('general.unnamedTrack')}
        </Item.Header>
        <Item.Meta>
          {privateTracks ? null : <span>{t('TracksPage.createdBy', {author: track.author.displayName})}</span>}
          <span>
            <FormattedDate date={track.createdAt} />
          </span>
        </Item.Meta>
        <Item.Description>
          <StripMarkdown>{maxLength(track.description, 200)}</StripMarkdown>
        </Item.Description>
        {privateTracks && (
          <Item.Extra>
            <Visibility public={track.public} />

            <span style={{marginLeft: '1em'}}>
              <Icon color={COLOR_BY_STATUS[track.processingStatus]} name="bolt" fitted />{' '}
              {t(`TracksPage.processing.${track.processingStatus}`)}
            </span>
          </Item.Extra>
        )}
      </Item.Content>
    </Item>
  )
}

function UploadButton({navigate, ...props}) {
  const {t} = useTranslation()
  const onClick = useCallback(
    (e) => {
      e.preventDefault()
      navigate()
    },
    [navigate]
  )
  return (
    <Button onClick={onClick} {...props} color="green" style={{float: 'right'}}>
      {t('TracksPage.upload')}
    </Button>
  )
}

const TracksPage = connect((state) => ({login: (state as any).login}))(function TracksPage({login, privateTracks}) {
  const {t} = useTranslation()
  const title = privateTracks ? t('TracksPage.titleUser') : t('TracksPage.titlePublic')

  return (
    <Page title={title}>
      <Header as="h2">{title}</Header>
      {privateTracks && <Link component={UploadButton} to="/upload" />}
      <TrackList {...{privateTracks}} />
    </Page>
  )
})

export default TracksPage
