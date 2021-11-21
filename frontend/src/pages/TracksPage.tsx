import React from 'react'
import {connect} from 'react-redux'
import {Button, Message, Item, Menu, Loader, Pagination, Icon} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {Link, useHistory, useRouteMatch} from 'react-router-dom'
import {of, from, concat} from 'rxjs'
import {map, switchMap, distinctUntilChanged} from 'rxjs/operators'
import _ from 'lodash'

import type {Track} from 'types'
import {Avatar, Page, StripMarkdown} from 'components'
import api from 'api'
import {useQueryParam} from 'query'

function TracksPageTabs() {
  const history = useHistory()

  const onClick = React.useCallback(
    (e, data) => {
      history.push(data.name)
    },
    [history]
  )

  const isOwnTracksPage = Boolean(useRouteMatch('/my/tracks'))

  return (
    <Menu pointing secondary>
      <Menu.Item name="/tracks" active={!isOwnTracksPage} {...{onClick}}>Tracks</Menu.Item>
      <Menu.Item name="/my/tracks" active={isOwnTracksPage} {...{onClick}} />
      <Menu.Item name="/upload" position='right' {...{onClick}}><Button color='green' compact size='small'>Upload</Button></Menu.Item>
    </Menu>
  )
}

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

  return (
    <div>
      <Loader content="Loading" active={loading} />
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
        <Message>
          No public tracks yet. <Link to="/upload">Upload the first!</Link>
        </Message>
      )}
    </div>
  )
}

function maxLength(t, max) {
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
  return (
    <Item key={track.slug}>
      <Item.Image size="tiny">
        <Avatar user={track.author} />
      </Item.Image>
      <Item.Content>
        <Item.Header as={Link} to={`/tracks/${track.slug}`}>
          {track.title || 'Unnamed track'}
        </Item.Header>
        <Item.Meta>
          Created by {track.author.username} on {track.createdAt}
        </Item.Meta>
        <Item.Description>
          <StripMarkdown>{maxLength(track.description, 200)}</StripMarkdown>
        </Item.Description>
        {privateTracks && (
          <Item.Extra>
            {track.public ? (
              <>
                <Icon color="blue" name="eye" fitted /> Public
              </>
            ) : (
              <>
                <Icon name="eye slash" fitted /> Private
              </>
            )}

            <span style={{marginLeft: '1em'}}>
              <Icon color={COLOR_BY_STATUS[track.processingStatus]} name="bolt" fitted /> Processing {track.processingStatus}
            </span>
          </Item.Extra>
        )}
      </Item.Content>
    </Item>
  )
}

const TracksPage = connect((state) => ({login: (state as any).login}))(function TracksPage({login, privateTracks}) {
  return (
    <Page>
      {login ? <TracksPageTabs /> : null}
      <TrackList {...{privateTracks}} />
    </Page>
  )
})

export default TracksPage
