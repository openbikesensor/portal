import React from 'react'
import {connect} from 'react-redux'
import {Message, Icon, Grid, Form, Button, TextArea, Ref, Input} from 'semantic-ui-react'
import {useForm} from 'react-hook-form'

import {setLogin} from 'reducers/login'
import {Page} from 'components'
import api from 'api'

function findInput(register) {
  return (element) => register(element ? element.querySelector('input, textarea, select') : null)
}

const SettingsPage = connect((state) => ({login: state.login}), {setLogin})(function SettingsPage({login, setLogin}) {
  const {register, handleSubmit} = useForm()
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState(null)

  const onSave = React.useCallback(
    async (changes) => {
      setLoading(true)
      setErrors(null)
      try {
        const response = await api.put('/user', {body: {user: changes}})
        setLogin(response.user)
      } catch (err) {
        setErrors(err.errors)
      } finally {
        setLoading(false)
      }
    },
    [setLoading, setLogin, setErrors]
  )

  return (
    <Page>
    <Grid centered relaxed divided>
    <Grid.Row>
    <Grid.Column width={8}>

      <h2>Your profile</h2>

      <Message info>All of this information is public.</Message>

      <Form onSubmit={handleSubmit(onSave)} loading={loading}>
        <Ref innerRef={findInput(register)}>
          <Form.Input error={errors?.username} label="Username" name="username" defaultValue={login.username} />
        </Ref>
        <Form.Field error={errors?.bio}>
          <label>Bio</label>
          <Ref innerRef={register}>
            <TextArea name="bio" rows={4} defaultValue={login.bio} />
          </Ref>
        </Form.Field>
        <Form.Field error={errors?.image}>
          <label>Avatar URL</label>
          <Ref innerRef={findInput(register)}>
            <Input name="image" defaultValue={login.image} />
          </Ref>
        </Form.Field>

        <Button type="submit" primary>
          Save
        </Button>
      </Form>
  </Grid.Column>
    <Grid.Column width={6}>
      <ApiKeyDialog {...{login}} />
    </Grid.Column>
    </Grid.Row>
    </Grid>
    </Page>
  )
})

const selectField = findInput((ref) => ref?.select())

function ApiKeyDialog({login}) {
  const [show, setShow] = React.useState(false)
  const onClick = React.useCallback(
    (e) => {
      e.preventDefault()
      setShow(true)
    },
    [setShow]
  )

  return (
    <>
      <h2>Your API Key</h2>
      <p>
        Here you find your API Key, for use in the OpenBikeSensor. You can
        to copy and paste it into your sensor's configuration interface to
        allow direct upload from the device.
      </p>
      <p>Please protect your API Key carefully as it allows full control over your account.</p>
      {show ? (
        <Ref innerRef={selectField}>
          <Input value={login.apiKey} fluid />
        </Ref>
      ) : (
        <Button onClick={onClick}><Icon name='lock' /> Show API Key</Button>
      )}
    </>
  )
}

export default SettingsPage
