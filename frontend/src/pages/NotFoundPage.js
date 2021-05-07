import React from 'react'
import {Button, Header} from 'semantic-ui-react'
import {useHistory} from 'react-router-dom'

import {Page} from '../components'

export default function NotFoundPage() {
  const history = useHistory()
  return (
    <Page>
      <Header as="h2">Page not found</Header>
      <p>You know what that means...</p>
      <Button onClick={history.goBack.bind(history)}>Go back</Button>
    </Page>
  )
}
