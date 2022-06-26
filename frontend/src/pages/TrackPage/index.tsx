import React from 'react'
import {connect} from 'react-redux'
import {List, Dropdown, Checkbox, Segment, Dimmer, Grid, Loader, Header, Message, Confirm} from 'semantic-ui-react'
import {useParams, useHistory} from 'react-router-dom'
import {concat, combineLatest, of, from, Subject} from 'rxjs'
import {pluck, distinctUntilChanged, map, switchMap, startWith, catchError} from 'rxjs/operators'
import {useObservable} from 'rxjs-hooks'
import Markdown from 'react-markdown'

import api from 'api'
import {Page} from 'components'
import type {Track, TrackData, TrackComment} from 'types'
import {trackLayer, trackLayerRaw} from '../../mapstyles'

import TrackActions from './TrackActions'
import TrackComments from './TrackComments'
import TrackDetails from './TrackDetails'
import TrackMap from './TrackMap'

import styles from './TrackPage.module.less'

function useTriggerSubject() {
  const subject$ = React.useMemo(() => new Subject(), [])
  const trigger = React.useCallback(() => subject$.next(null), [subject$])
  return [trigger, subject$]
}

function TrackMapSettings({showTrack, setShowTrack, pointsMode, setPointsMode, side, setSide}) {
  return (
    <>
      <Header as="h4">Map settings</Header>
      <List>
        <List.Item>
          <Checkbox checked={showTrack} onChange={(e, d) => setShowTrack(d.checked)} /> Show track
          <div style={{marginTop: 8}}>
            <span style={{borderTop: '3px dashed ' + trackLayerRaw.paint['line-color'], height: 0, width: 24, display: 'inline-block', verticalAlign: 'middle', marginRight: 4}} />
            GPS track
          </div>
          <div>
            <span style={{borderTop: '6px solid ' + trackLayerRaw.paint['line-color'], height: 6, width: 24, display: 'inline-block', verticalAlign: 'middle', marginRight: 4}} />
            Snapped to road
          </div>
        </List.Item>
        <List.Item>
          <List.Header>Points</List.Header>
          <Dropdown
            selection
            value={pointsMode}
            onChange={(e, d) => setPointsMode(d.value)}
            options={[
              {key: 'none', value: 'none', text: 'None'},
              {key: 'overtakingEvents', value: 'overtakingEvents', text: 'Confirmed'},
              {key: 'measurements', value: 'measurements', text: 'All measurements'},
            ]}
          />
        </List.Item>
        <List.Item>
          <List.Header>Side (for color)</List.Header>
          <Dropdown
            selection
            value={side}
            onChange={(e, d) => setSide(d.value)}
            options={[
              {key: 'overtaker', value: 'overtaker', text: 'Overtaker (Left)'},
              {key: 'stationary', value: 'stationary', text: 'Stationary (Right)'},
            ]}
          />
        </List.Item>
      </List>
    </>
  )
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

  const [downloadError, setDownloadError] = React.useState(null)
  const hideDownloadError = React.useCallback(() => setDownloadError(null), [setDownloadError])
  const onDownload = React.useCallback(
    async (filename) => {
      try {
        await api.downloadFile(`/tracks/${slug}/download/${filename}`)
      } catch (err) {
        if (/Failed to fetch/.test(String(err))) {
          setDownloadError(
            'The track probably has not been imported correctly or recently enough. Please ask your administrator for assistance.'
          )
        } else {
          setDownloadError(String(err))
        }
      }
    },
    [slug]
  )

  const isAuthor = login?.username === data?.track?.author?.username

  const {track, trackData, comments} = data || {}

  const loading = track == null || trackData === undefined
  const processing = ['processing', 'queued', 'created'].includes(track?.processingStatus)
  const error = track?.processingStatus === 'error'

  const [showTrack, setShowTrack] = React.useState(true)
  const [pointsMode, setPointsMode] = React.useState('overtakingEvents') // none|overtakingEvents|measurements
  const [side, setSide] = React.useState('overtaker') // overtaker|stationary

  const title = track ? track.title || 'Unnamed track' : null
  return (
    <Page
      title={title}
      stage={
        <div className={styles.stage}>
          <Loader active={loading} />
          <Dimmer.Dimmable blurring dimmed={loading}>
            <TrackMap {...{track, trackData, pointsMode, side, showTrack}} style={{height: '80vh'}} />
          </Dimmer.Dimmable>

          <div className={styles.details}>
            {processing && (
              <Message warning>
                <Message.Content>Track data is still being processed, please reload page in a while.</Message.Content>
              </Message>
            )}

            {error && (
              <Message error>
                <Message.Content>
                  The processing of this track failed, please ask your site administrator for help in debugging the
                  issue.
                </Message.Content>
              </Message>
            )}

            <Segment>
              {track && (
                <>
                  <Header as="h1">{title}</Header>
                  <TrackDetails {...{track, isAuthor}} />
                  <TrackActions {...{isAuthor, onDownload, slug}} />
                </>
              )}
            </Segment>
          </div>
        </div>
      }
    >
      <Confirm
        open={downloadError != null}
        cancelButton={false}
        onConfirm={hideDownloadError}
        header="Download failed"
        content={String(downloadError)}
      />
      <Grid stackable>
        <Grid.Row>
          <Grid.Column width={12}>
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
          </Grid.Column>
          <Grid.Column width={4}>
            <TrackMapSettings {...{showTrack, setShowTrack, pointsMode, setPointsMode, side, setSide}} />
          </Grid.Column>
        </Grid.Row>
      </Grid>

      {/* <pre>{JSON.stringify(data, null, 2)}</pre> */}
    </Page>
  )
})

export default TrackPage
