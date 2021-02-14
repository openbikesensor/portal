import React from 'react'
import {connect} from 'react-redux'
import {Link} from 'react-router-dom'
import {Segment, Dimmer, Form, Button, List, Grid, Loader, Header, Comment} from 'semantic-ui-react'
import {useParams} from 'react-router-dom'
import {concat, combineLatest, of, from} from 'rxjs'
import {pluck, distinctUntilChanged, map, switchMap, startWith} from 'rxjs/operators'
import {useObservable} from 'rxjs-hooks'
import {Settings, DateTime, Duration} from 'luxon'

import {Vector as VectorSource} from 'ol/source';
import {Geometry, LineString, Point} from 'ol/geom';
import Feature from 'ol/Feature';
import {fromLonLat} from 'ol/proj';
import proj4 from 'proj4';
import {register} from 'ol/proj/proj4';
import {Fill, Stroke, Style, Text, Circle} from 'ol/style';

import api from '../api'
import {Map, Page} from '../components'
import type {Track, TrackData, TrackComment} from '../types'

proj4.defs('projLayer1', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs');
register(proj4);

// TODO: remove
Settings.defaultLocale = 'de-DE'

function formatDuration(seconds) {
  return Duration.fromMillis((seconds ?? 0) * 1000).toFormat("h'h' mm'm'")
}

function FormattedDate({date, relative = false}) {
  if (date == null) {
    return null
  }

  const dateTime =
    typeof date === 'string' ? DateTime.fromISO(date) : date instanceof Date ? DateTime.fromJSDate(date) : date

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

      <Loader active={track != null && trackData == null} inline="centered" style={{marginTop: 16, marginBottom: 16}} />

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
                <div>
                  <FormattedDate date={comment.createdAt} relative />
                </div>
              </Comment.Metadata>
              <Comment.Text>{comment.body}</Comment.Text>
            </Comment.Content>
          </Comment>
        ))}

        {login && comments != null && (
          <Form reply>
            <Form.TextArea rows={4} />
            <Button content="Post comment" labelPosition="left" icon="edit" primary />
          </Form>
        )}
      </Comment.Group>
    </Segment>
  )
}

const isValidTrackPoint = (point: TrackPoint): boolean =>
  point.latitude != null && point.longitude != null && (point.latitude !== 0 || point.longitude !== 0)

function TrackMap({track, trackData, ...props}) {
  const {
    trackVectorSource,
    trackPointsD1,
    trackPointsD2,
    trackPointsUntaggedD1,
    trackPointsUntaggedD2,
    viewExtent,
  } = React.useMemo(() => {
    const trackPointsD1: Feature<Geometry>[] = []
    const trackPointsD2: Feature<Geometry>[] = []
    const trackPointsUntaggedD1: Feature<Geometry>[] = []
    const trackPointsUntaggedD2: Feature<Geometry>[] = []
    const points: Coordinate[] = []
    const filteredPoints: TrackPoint[] = trackData?.points.filter(isValidTrackPoint) ?? []

    for (const dataPoint of filteredPoints) {
      const {longitude, latitude, flag, d1, d2} = dataPoint

      const p = fromLonLat([longitude, latitude])
      points.push(p)

      const geometry = new Point(p)

      if (flag && d1) {
        trackPointsD1.push(new Feature({distance: d1, geometry}))
      }

      if (flag && d2) {
        trackPointsD2.push(new Feature({distance: d2, geometry}))
      }

      if (!flag && d1) {
        trackPointsUntaggedD1.push(new Feature({distance: d1, geometry}))
      }

      if (!flag && d2) {
        trackPointsUntaggedD2.push(new Feature({distance: d2, geometry}))
      }
    }

    //Simplify to 1 point per 2 meter
    const trackVectorSource = new VectorSource({
      features: [new Feature(new LineString(points).simplify(2))],
    })

    const viewExtent = points.length ? trackVectorSource.getExtent() : null
    return {trackVectorSource, trackPointsD1, trackPointsD2, trackPointsUntaggedD1, trackPointsUntaggedD2, viewExtent}
  }, [trackData?.points])


  const trackLayerStyle = React.useMemo(
    () =>
      new Style({
        stroke: new Stroke({
          width: 3,
          color: 'rgb(30,144,255)',
        }),
      }),
    []
  )

  return (
    <Map {...props}>
      <Map.TileLayer />
      <Map.VectorLayer
        visible
        updateWhileAnimating={false}
        updateWhileInteracting={false}
        source={trackVectorSource}
        style={trackLayerStyle}
      />

      <Map.GroupLayer title="Tagged Points">
        <PointLayer features={trackPointsD1} title="Left" visible={true} />
        <PointLayer features={trackPointsD2} title="Right" visible={false} />
      </Map.GroupLayer>

      <Map.GroupLayer title="Untagged Points" fold="close" visible={false}>
        <PointLayer features={trackPointsUntaggedD1} title="Left Untagged" visible={false} />
        <PointLayer features={trackPointsUntaggedD2} title="Right Untagged" visible={false} />
      </Map.GroupLayer>

      <Map.View maxZoom={22} zoom={15} center={fromLonLat([9.1797, 48.7784])} />
      <Map.FitView extent={viewExtent} />
      <Map.LayerSwitcher groupSelectStyle='children' startActive activationMode='click' reverse={false} />
    </Map>
  )
}

function pointStyleFunction(feature, resolution) {
  let distance = feature.get('distance')
  let radius = 200 / resolution

  return new Style({
    image: new Circle({
      radius: radius < 20 ? radius : 20,
      fill: evaluateDistanceForFillColor(distance),
      stroke: evaluateDistanceForStrokeColor(distance),
    }),
    text: createTextStyle(distance, resolution),
  })
}

const evaluateDistanceForFillColor = function (distance) {
  const redFill = new Fill({color: 'rgba(255, 0, 0, 0.2)'})
  const orangeFill = new Fill({color: 'rgba(245,134,0,0.2)'})
  const greenFill = new Fill({color: 'rgba(50, 205, 50, 0.2)'})

  switch (evaluateDistanceColor(distance)) {
    case 'red':
      return redFill
    case 'orange':
      return orangeFill
    case 'green':
      return greenFill
  }
}

const evaluateDistanceForStrokeColor = function (distance) {
  const redStroke = new Stroke({color: 'rgb(255, 0, 0)'})
  const orangeStroke = new Stroke({color: 'rgb(245,134,0)'})
  const greenStroke = new Stroke({color: 'rgb(50, 205, 50)'})

  switch (evaluateDistanceColor(distance)) {
    case 'red':
      return redStroke
    case 'orange':
      return orangeStroke
    case 'green':
      return greenStroke
  }
}

    const WARN_DISTANCE= 200
    const MIN_DISTANCE= 150


const evaluateDistanceColor = function (distance) {
  if (distance < MIN_DISTANCE) {
    return 'red'
  } else if (distance < WARN_DISTANCE) {
    return 'orange'
  } else {
    return 'green'
  }
}

const createTextStyle = function (distance, resolution) {
  return new Text({
    textAlign: 'center',
    textBaseline: 'middle',
    font: 'normal 18px/1 Arial',
    text: resolution < 6 ? '' + distance : '',
    fill: new Fill({color: evaluateDistanceColor(distance)}),
    stroke: new Stroke({color: 'white', width: 2}),
    offsetX: 0,
    offsetY: 0,
  })
}

function PointLayer({features, title, visible}) {
  return <Map.VectorLayer {...{title, visible}} style={pointStyleFunction} source={new VectorSource({features})} />
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
                <TrackMap {...{track, trackData}} style={{height: '60vh', minHeight: 400}} />
              </Dimmer.Dimmable>
            </div>
          </Grid.Column>
          <Grid.Column width={4}>
            <Segment>
              {track && (
                <>
                  <Header as="h1">{track.title}</Header>
                  <TrackDetails {...{track, trackData, isAuthor}} />
                  {isAuthor && <TrackActions {...{slug}} />}
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
