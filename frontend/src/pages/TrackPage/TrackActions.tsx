import React from 'react'
import {Link} from 'react-router-dom'
import {Icon, Popup, Button, Dropdown} from 'semantic-ui-react'

export default function TrackActions({slug, isAuthor, onDownload}) {
  return (
    <>
      {isAuthor && (
        <Link to={`/tracks/${slug}/edit`}>
          <Button primary>Edit track</Button>
        </Link>
      )}

      <Dropdown text="Download" button upward>
        <Dropdown.Menu>
          <Dropdown.Item text="Original" onClick={() => onDownload('original.csv')} disabled={!isAuthor} />
          <Dropdown.Item text="Track (GPX)" onClick={() => onDownload('track.gpx')} />
        </Dropdown.Menu>
      </Dropdown>

      <Popup
        trigger={<Icon name="info circle" />}
        offset={[12, 0]}
        content={
          isAuthor ? (
            <>
              <p>Only you, the author of this track, can download the original file.</p>
              <p>
                This is the file as it was uploaded to the server, without modifications, and it can be used with other
                tools.
              </p>
            </>
          ) : (
            <p>Only the author of this track can download the original file.</p>
          )
        }
      />
    </>
  )
}
