import React from 'react'
import {Link} from 'react-router-dom'
import {Icon, Popup, Button, Dropdown} from 'semantic-ui-react'
import {useTranslation} from 'react-i18next'

export default function TrackActions({slug, isAuthor, onDownload}) {
  const {t} = useTranslation()

  return (
    <>
      <Popup
        trigger={<Icon name="info circle" />}
        offset={[12, 0]}
        content={
          isAuthor ? (
            <>
              <p>{t('TrackPage.actions.hintAuthorOnly')}</p>
              <p>{t('TrackPage.actions.hintOriginal')}</p>
            </>
          ) : (
            <p>{t('TrackPage.actions.hintAuthorOnlyOthers')}</p>
          )
        }
      />

      <Dropdown text={t('TrackPage.actions.download')} button>
        <Dropdown.Menu>
          <Dropdown.Item
            text={t('TrackPage.actions.original')}
            onClick={() => onDownload('original.csv')}
            disabled={!isAuthor}
          />
          <Dropdown.Item text={t('TrackPage.actions.gpx')} onClick={() => onDownload('track.gpx')} />
        </Dropdown.Menu>
      </Dropdown>

      {isAuthor && (
        <Link to={`/tracks/${slug}/edit`}>
          <Button primary>{t('TrackPage.actions.edit')}</Button>
        </Link>
      )}
    </>
  )
}
