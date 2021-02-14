import React from 'react'
import {connect} from 'react-redux'
import {Item, Tab, Loader, Pagination, Icon} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {Link, useHistory, useRouteMatch} from 'react-router-dom'
import {of, from, concat} from 'rxjs'
import {map, switchMap, distinctUntilChanged} from 'rxjs/operators'
import _ from 'lodash'

import type {Track} from '../types'
import {Page} from '../components'
import api from '../api'
import {useQueryParam} from '../query'

function TracksPageTabs() {
  const history = useHistory()
  const panes = React.useMemo(
    () => [
      {menuItem: 'Global Feed', url: '/feed'},
      {menuItem: 'Your Feed', url: '/feed/my'},
    ],
    []
  )

  const onTabChange = React.useCallback(
    (e, data) => {
      history.push(panes[data.activeIndex].url)
    },
    [history, panes]
  )

  const isFeedPage = useRouteMatch('/feed/my')
  const activeIndex = isFeedPage ? 1 : 0

  return <Tab menu={{secondary: true, pointing: true}} {...{panes, onTabChange, activeIndex}} />
}

function TrackList({privateFeed}: {privateFeed: boolean}) {
  const [page, setPage] = useQueryParam<number>('page', 1, Number)
  console.log('page', page)

  const pageSize = 10

  const data: {
    tracks: Track[]
    tracksCount: number
  } | null = useObservable(
    (_$, inputs$) =>
      inputs$.pipe(
        map(([page, privateFeed]) => {
          const url = '/tracks' + (privateFeed ? '/feed' : '')
          const query = {limit: pageSize, offset: pageSize * (page - 1)}
          return {url, query}
        }),
        distinctUntilChanged(_.isEqual),
        switchMap((request) => concat(of(null), from(api.get(request.url, {query: request.query})))),
      ),
    null,
    [page, privateFeed]
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

      {tracks && (
        <Item.Group divided>
          {tracks.map((track: Track) => (
            <TrackListItem key={track.slug} {...{track, privateFeed}} />
          ))}
        </Item.Group>
      )}
    </div>
  )
}

export function TrackListItem({track, privateFeed = false}) {
  return (
    <Item key={track.slug}>
      <Item.Image size="tiny" src={track.author.image} />
      <Item.Content>
        <Item.Header as={Link} to={`/tracks/${track.slug}`}>
          {track.title}
        </Item.Header>
        <Item.Meta>
          Created by {track.author.username} on {track.createdAt}
        </Item.Meta>
        <Item.Description>{track.description}</Item.Description>
        {privateFeed && (
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

const TracksPage = connect((state) => ({login: (state as any).login}))(function TracksPage({login, privateFeed}) {
  return (
    <Page>
      {login ? <TracksPageTabs /> : null}
      <TrackList {...{privateFeed}} />
    </Page>
  )
})

export default TracksPage
