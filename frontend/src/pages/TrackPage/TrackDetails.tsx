import React from 'react'
import _ from 'lodash'
import {List, Header, Grid} from 'semantic-ui-react'
import {Duration} from 'luxon'
import {useTranslation} from 'react-i18next'

import {FormattedDate, Visibility} from 'components'
import {formatDistance, formatDuration} from 'utils'

export default function TrackDetails({track, isAuthor}) {
  const {t} = useTranslation()

  const items = [
    track.public != null && isAuthor && [t('TrackPage.details.visibility'), <Visibility public={track.public} />],

    track.uploadedByUserAgent != null && [t('TrackPage.details.uploadedWith'), track.uploadedByUserAgent],

    track.duration != null && [t('TrackPage.details.duration'), formatDuration(track.duration)],

    track.createdAt != null && [t('TrackPage.details.uploadedDate'), <FormattedDate date={track.createdAt} />],

    track?.recordedAt != null && [t('TrackPage.details.recordedDate'), <FormattedDate date={track?.recordedAt} />],

    track?.numEvents != null && [t('TrackPage.details.numEvents'), track?.numEvents],

    track?.length != null && [t('TrackPage.details.length'), formatDistance(track?.length)],

    track?.processingStatus != null &&
      track?.processingStatus != 'error' && [t('TrackPage.details.processingStatus'), track.processingStatus],

    track.originalFileName != null && [t('TrackPage.details.originalFileName'), <code>{track.originalFileName}</code>],
  ].filter(Boolean)

  const COLUMNS = 4
  const chunkSize = Math.ceil(items.length / COLUMNS)
  return (
    <Grid>
      <Grid.Row columns={COLUMNS}>
        {_.chunk(items, chunkSize).map((chunkItems, idx) => (
          <Grid.Column key={idx}>
            <List>
              {chunkItems.map(([title, value]) => (
                <List.Item key={title}>
                  <List.Header>{title}</List.Header>
                  <List.Description>{value}</List.Description>
                </List.Item>
              ))}
            </List>
          </Grid.Column>
        ))}
      </Grid.Row>
    </Grid>
  )
}
