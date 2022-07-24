import React from 'react'
import {List} from 'semantic-ui-react'
import {Duration} from 'luxon'

import {FormattedDate} from 'components'

function formatDuration(seconds) {
  return Duration.fromMillis((seconds ?? 0) * 1000).toFormat("h'h' mm'm'")
}

export default function TrackDetails({track, isAuthor}) {
  return (
    <List horizontal relaxed>
      {track.public != null && isAuthor && (
        <List.Item>
          <List.Header>Visibility</List.Header>
          {track.public ? 'Public' : 'Private'}
        </List.Item>
      )}

      {track.originalFileName != null && (
        <List.Item>
          {isAuthor && <div style={{float: 'right'}}></div>}

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

      {track.duration != null && (
        <List.Item>
          <List.Header>Duration</List.Header>
          {formatDuration(track.duration)}
        </List.Item>
      )}

      {track.createdAt != null && (
        <List.Item>
          <List.Header>Uploaded on</List.Header>
          <FormattedDate date={track.createdAt} />
        </List.Item>
      )}

      {track?.recordedAt != null && (
        <List.Item>
          <List.Header>Recorded on</List.Header>
          <FormattedDate date={track?.recordedAt} />
        </List.Item>
      )}

      {track?.numEvents != null && (
        <List.Item>
          <List.Header>Confirmed events</List.Header>
          {track?.numEvents}
        </List.Item>
      )}

      {track?.length != null && (
        <List.Item>
          <List.Header>Length</List.Header>
          {(track?.length / 1000).toFixed(2)} km
        </List.Item>
      )}

      {track?.processingStatus != null && track?.processingStatus != 'error' && (
        <List.Item>
          <List.Header>Processing</List.Header>
          {track.processingStatus}
        </List.Item>
      )}
    </List>
  )
}
