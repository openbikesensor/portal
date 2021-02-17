import React from 'react'
import {Link} from 'react-router-dom'
import {Button} from 'semantic-ui-react'

export default function TrackActions({slug}) {
  return (
    <Button.Group vertical>
      <Link to={`/tracks/${slug}/edit`}>
        <Button primary>Edit track</Button>
      </Link>
    </Button.Group>
  )
}
