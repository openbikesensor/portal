import React from 'react'
import {Link} from 'react-router-dom'
import {Icon, Popup, Button, Dropdown} from 'semantic-ui-react'

export default function TrackActions({slug, isAuthor, onDownload}) {
  return (
    <>
      {isAuthor ? (
        <Dropdown text="Download" button upward>
          <Dropdown.Menu>
            <Popup
              content={
                <>
                  <p>Only you, the author of this track, can download the original file.</p>
                  <p>
                    This is the file as it was uploaded to the server, without modifications, and it can be used with
                    other tools. Exporting to other formats, and downloading modified files, will be implemented soon.
                  </p>
                </>
              }
                trigger={<Dropdown.Item text="Original" onClick={() => onDownload('original.csv')} />}
            />
                  <Dropdown.Item text="Track (GPX)" onClick={() => onDownload('track.gpx')} />
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <>
          <Button disabled>Download</Button>
          <Popup
            content={<p>Only the author of this track can download the original file.</p>}
            trigger={<Icon name="info circle" />}
          />
        </>
      )}

      {isAuthor && (
        <Link to={`/tracks/${slug}/edit`}>
          <Button primary>Edit track</Button>
        </Link>
      )}
    </>
  )
}
