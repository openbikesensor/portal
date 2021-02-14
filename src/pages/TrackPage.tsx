import React from 'react'
import {connect} from 'react-redux'
import {Link} from 'react-router-dom'
import {Segment, Dimmer ,Form, Button, List, Grid, Loader, Header, Comment} from 'semantic-ui-react'
import {useParams} from 'react-router-dom'
import {concat, combineLatest, of, from} from 'rxjs'
import {pluck, distinctUntilChanged, map, switchMap, startWith} from 'rxjs/operators'
import {useObservable} from 'rxjs-hooks'
import {Settings, DateTime, Duration} from 'luxon'

import api from '../api'
import {Map, Page} from '../components'
import type {Track, TrackData, TrackComment} from '../types'

// TODO: remove
Settings.defaultLocale = 'de-DE'

function formatDuration(seconds) {
  return Duration.fromMillis((seconds ?? 0) * 1000).toFormat("h'h' mm'm'")
}

function FormattedDate({date, relative=false}) {
  if (date == null) {
    return null
  }

  const dateTime = typeof date === 'string' ? DateTime.fromISO(date) : date instanceof Date ? DateTime.fromJSDate(date) : date

  let str

  if (relative) {
    str = dateTime.toRelative()
  } else {
    str = dateTime.toLocaleString(DateTime.DATETIME_MED)
  }

  return <span title={dateTime.toISO()}>{str}</span>
}

function TrackDetails({track, isAuthor, trackData}) {
  return (
    <List>
      {track.visible != null && isAuthor && (
        <List.Item>
          <List.Header>Visibility</List.Header>
          {track.visible ? 'Public' : 'Private'}
        </List.Item>
      )}

      {track.originalFileName != null && (
        <List.Item>
          <List.Header>Original Filename</List.Header>
          <code>{track.originalFileName}</code>
        </List.Item>
      )}

      {track.uploadedByUserAgent != null && (
        <List.Item>
          <List.Header>Uploaded with</List.Header>
          {track.uploadedByUserAgent}
        </List.Item>
      )}

      {track.duration == null && (
        <List.Item>
          <List.Header>Duration</List.Header>
          {formatDuration(track.duration || 1402)}
        </List.Item>
      )}

      {track.createdAt != null && (
        <List.Item>
          <List.Header>Uploaded on</List.Header>
          <FormattedDate date={track.createdAt} />
        </List.Item>
      )}

      <Loader active={track != null && trackData == null} inline='centered' style={{marginTop: 16, marginBottom: 16}} />

      {trackData?.recordedAt != null && (
        <List.Item>
          <List.Header>Recorded on</List.Header>
          <FormattedDate date={trackData.recordedAt} />
        </List.Item>
      )}

      {trackData?.numEvents != null && (
        <List.Item>
          <List.Header>Confirmed events</List.Header>
          {trackData.numEvents}
        </List.Item>
      )}

      {trackData?.trackLength != null && (
        <List.Item>
          <List.Header>Length</List.Header>
          {(trackData.trackLength / 1000).toFixed(2)} km
        </List.Item>
      )}
    </List>
  )
}

function TrackActions({slug}) {
  return (
    <Button.Group vertical>
      <Link to={`/tracks/${slug}/edit`}>
        <Button primary>Edit track</Button>
      </Link>
    </Button.Group>
  )
}

function TrackComments({comments, login, hideLoader}) {
  return (
    <Segment basic>
    <Comment.Group>
      <Header as="h2" dividing>
        Comments
      </Header>

      <Loader active={!hideLoader && comments == null} inline />

      {comments?.map((comment: TrackComment) => (
        <Comment key={comment.id}>
          <Comment.Avatar src={comment.author.image} />
          <Comment.Content>
            <Comment.Author as="a">{comment.author.username}</Comment.Author>
            <Comment.Metadata>
              <div><FormattedDate date={comment.createdAt} relative /></div>
            </Comment.Metadata>
            <Comment.Text>{comment.body}</Comment.Text>
          </Comment.Content>
        </Comment>
      ))}


      {login && comments != null && <Form reply>
        <Form.TextArea rows={4} />
        <Button content='Post comment' labelPosition='left' icon='edit' primary />
      </Form>}
    </Comment.Group>
      </Segment>
  )
}

const TrackPage = connect((state) => ({login: state.login}))(function TrackPage({login}) {
  const {slug} = useParams()

  const data: {
    track: null | Track
    trackData: null | TrackData
    comments: null | TrackComments
  } | null = useObservable(
    (_$, args$) => {
      const slug$ = args$.pipe(pluck(0), distinctUntilChanged())
      const track$ = slug$.pipe(
        map((slug) => '/tracks/' + slug),
        switchMap((url) => concat(of(null), from(api.fetch(url)))),
        pluck('track')
      )

      const trackData$ = slug$.pipe(
        map((slug) => '/tracks/' + slug + '/data'),
        switchMap((url) => concat(of(null), from(api.fetch(url)))),
        pluck('trackData'),
        startWith(null) // show track infos before track data is loaded
      )

      const comments$ = slug$.pipe(
        map((slug) => '/tracks/' + slug + '/comments'),
        switchMap((url) => concat(of(null), from(api.fetch(url)))),
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

  const isAuthor = login?.username === data?.track?.author?.username

  const {track, trackData, comments} = data || {}

  const loading = track == null || trackData == null

  return (
    <Page>
      <Grid stackable>
        <Grid.Row>
          <Grid.Column width={12}>
            <div style={{position: 'relative'}}>
            <Loader active={loading} />
            <Dimmer.Dimmable blurring dimmed={loading}>
          <Map style={{height: '60vh', minHeight: 400}}>
            <Map.TileLayer />
              </Map>
            </Dimmer.Dimmable>
              </div>
          </Grid.Column>
          <Grid.Column width={4}>
            <Segment>
            {track && (
              <>
                <Header as='h1'>{track.title}</Header>
                <TrackDetails {...{track, trackData, isAuthor}} />
                {isAuthor && <TrackActions {...{slug}}   />}
              </>
            )}
                </Segment>
          </Grid.Column>
        </Grid.Row>
      </Grid>

      <TrackComments {...{hideLoader: loading, comments, login}} />

      {/* <pre>{JSON.stringify(data, null, 2)}</pre> */}
    </Page>
  )
})

export default TrackPage
