import React from 'react'
import {connect} from 'react-redux'
import {Table, Checkbox, Segment, Dimmer, Grid, Loader, Header, Message} from 'semantic-ui-react'
import {useParams, useHistory} from 'react-router-dom'
import {concat, combineLatest, of, from, Subject} from 'rxjs'
import {pluck, distinctUntilChanged, map, switchMap, startWith, catchError} from 'rxjs/operators'
import {useObservable} from 'rxjs-hooks'
import Markdown from 'react-markdown'

import api from 'api'
import {Page} from 'components'
import type {Track, TrackData, TrackComment} from 'types'

import TrackActions from './TrackActions'
import TrackComments from './TrackComments'
import TrackDetails from './TrackDetails'
import TrackMap from './TrackMap'

function useTriggerSubject() {
  const subject$ = React.useMemo(() => new Subject(), [])
  const trigger = React.useCallback(() => subject$.next(null), [subject$])
  return [trigger, subject$]
}

const TrackPage = connect((state) => ({login: state.login}))(function TrackPage({login}) {
  const {slug} = useParams()

  const [reloadComments, reloadComments$] = useTriggerSubject()
  const history = useHistory()

  const data: {
    track: null | Track
    trackData: null | TrackData
    comments: null | TrackComment[]
  } | null = useObservable(
    (_$, args$) => {
      const slug$ = args$.pipe(pluck(0), distinctUntilChanged())
      const track$ = slug$.pipe(
        map((slug) => `/tracks/${slug}`),
        switchMap((url) =>
          concat(
            of(null),
            from(api.get(url)).pipe(
              catchError(() => {
                history.replace('/tracks')
              })
            )
          )
        ),
        pluck('track')
      )

      const trackData$ = slug$.pipe(
        map((slug) => `/tracks/${slug}/data`),
        switchMap((url) =>
          concat(
            of(undefined),
            from(api.get(url)).pipe(
              catchError(() => {
                return of(null)
              })
            )
          )
        ),
        startWith(undefined) // show track infos before track data is loaded
      )

      const comments$ = concat(of(null), reloadComments$).pipe(
        switchMap(() => slug$),
        map((slug) => `/tracks/${slug}/comments`),
        switchMap((url) =>
          from(api.get(url)).pipe(
            catchError(() => {
              return of(null)
            })
          )
        ),
        pluck('comments'),
        startWith(null) // show track infos before comments are loaded
      )

      return combineLatest([track$, trackData$, comments$]).pipe(
        map(([track, trackData, comments]) => ({track, trackData, comments}))
      )
    },
    null,
    [slug]
  )

  const onSubmitComment = React.useCallback(
    async ({body}) => {
      await api.post(`/tracks/${slug}/comments`, {
        body: {comment: {body}},
      })
      reloadComments()
    },
    [slug, reloadComments]
  )

  const onDeleteComment = React.useCallback(
    async (id) => {
      await api.delete(`/tracks/${slug}/comments/${id}`)
      reloadComments()
    },
    [slug, reloadComments]
  )

  const onDownloadOriginal = React.useCallback(
    () => {
      api.downloadFile(`/tracks/${slug}/download/original.csv`)
    },
    [slug]
  )

  const isAuthor = login?.username === data?.track?.author?.username

  const {track, trackData, comments} = data || {}

  console.log({track, trackData})
  const loading = track == null || trackData === undefined
  const processing = ['processing', 'queued', 'created'].includes(track?.processingStatus)
  const error = track?.processingStatus === 'error'

  const [left, setLeft] = React.useState(true)
  const [right, setRight] = React.useState(false)
  const [leftUnconfirmed, setLeftUnconfirmed] = React.useState(false)
  const [rightUnconfirmed, setRightUnconfirmed] = React.useState(false)

  return (
    <Page>
      {processing && (
        <Message warning>
          <Message.Content>
            Track data is still being processed, please reload page in a while.
          </Message.Content>
        </Message>
      )}

      {error && (
        <Message error>
          <Message.Content>
            The processing of this track failed, please ask your site
            administrator for help in debugging the issue.
          </Message.Content>
        </Message>
      )}

      <Grid stackable>
        <Grid.Row>
          <Grid.Column width={12}>
            <div style={{position: 'relative'}}>
              <Loader active={loading} />
              <Dimmer.Dimmable blurring dimmed={loading}>
                <TrackMap
                  {...{track, trackData, show: {left, right, leftUnconfirmed, rightUnconfirmed}}}
                  style={{height: '60vh', minHeight: 400}}
                />
              </Dimmer.Dimmable>
            </div>
          </Grid.Column>
          <Grid.Column width={4}>
            <Segment>
              {track && (
                <>
                  <Header as="h1">{track.title || 'Unnamed track'}</Header>
                  <TrackDetails {...{track, isAuthor}} />
                  <TrackActions {...{isAuthor, onDownloadOriginal, slug}} />
                </>
              )}
            </Segment>

            <Header as="h4">Map settings</Header>

            <Table compact>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Left</Table.HeaderCell>
                  <Table.HeaderCell textAlign="center">Show distance of</Table.HeaderCell>
                  <Table.HeaderCell textAlign="right">Right</Table.HeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                <Table.Row>
                  <Table.Cell>
                    <Checkbox checked={left} onChange={(e, d) => setLeft(d.checked)} />{' '}
                  </Table.Cell>
                  <Table.Cell textAlign="center">Events</Table.Cell>
                  <Table.Cell textAlign="right">
                    <Checkbox checked={right} onChange={(e, d) => setRight(d.checked)} />{' '}
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell>
                    <Checkbox checked={leftUnconfirmed} onChange={(e, d) => setLeftUnconfirmed(d.checked)} />{' '}
                  </Table.Cell>
                  <Table.Cell textAlign="center">Other points</Table.Cell>
                  <Table.Cell textAlign="right">
                    <Checkbox checked={rightUnconfirmed} onChange={(e, d) => setRightUnconfirmed(d.checked)} />{' '}
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </Grid.Column>
        </Grid.Row>
      </Grid>

      {track?.description && (
        <Segment basic>
          <Header as="h2" dividing>
            Description
          </Header>
          <Markdown>{track.description}</Markdown>
        </Segment>
      )}

      <TrackComments
        {...{hideLoader: loading, comments, login}}
        onSubmit={onSubmitComment}
        onDelete={onDeleteComment}
      />

      {/* <pre>{JSON.stringify(data, null, 2)}</pre> */}
    </Page>
  )
})

export default TrackPage
