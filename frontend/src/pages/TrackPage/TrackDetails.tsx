import React from 'react'
import {List, Loader} from 'semantic-ui-react'
import {Duration} from 'luxon'

import {FormattedDate} from 'components'

function formatDuration(seconds) {
  return Duration.fromMillis((seconds ?? 0) * 1000).toFormat("h'h' mm'm'")
}

export default function TrackDetails({track, isAuthor, trackData}) {
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
