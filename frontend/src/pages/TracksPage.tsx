import React from 'react'
import {connect} from 'react-redux'
import {Message, Item, Tab, Loader, Pagination, Icon} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {Link, useHistory, useRouteMatch} from 'react-router-dom'
import {of, from, concat} from 'rxjs'
import {map, switchMap, distinctUntilChanged} from 'rxjs/operators'
import _ from 'lodash'

import type {Track} from 'types'
import {Page, StripMarkdown} from 'components'
import api from 'api'
import {useQueryParam} from 'query'

function TracksPageTabs() {
  const history = useHistory()
  const panes = React.useMemo(
    () => [
      {menuItem: 'Public tracks', url: '/tracks'},
      {menuItem: 'My tracks', url: '/my/tracks'},
    ],
    []
  )

  const onTabChange = React.useCallback(
    (e, data) => {
      history.push(panes[data.activeIndex].url)
    },
    [history, panes]
  )

  const isOwnTracksPage = useRouteMatch('/my/tracks')
  const activeIndex = isOwnTracksPage ? 1 : 0

  return <Tab menu={{secondary: true, pointing: true}} {...{panes, onTabChange, activeIndex}} />
}

function TrackList({privateTracks}: {privateTracks: boolean}) {
  const [page, setPage] = useQueryParam<number>('page', 1, Number)

  const pageSize = 10

  const data: {
    tracks: Track[]
    tracksCount: number
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

  const {tracks, tracksCount} = data || {tracks: [], tracksCount: 0}
  const loading = !data
  const totalPages = tracksCount / pageSize

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

export function TrackListItem({track, privateTracks = false}) {
  return (
    <Item key={track.slug}>
      <Item.Image size="tiny" src={track.author.image} />
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
            {track.visible ? (
              <>
                <Icon color="blue" name="eye" fitted /> Public
              </>
            ) : (
              <>
                <Icon name="eye slash" fitted /> Private
              </>
            )}
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
