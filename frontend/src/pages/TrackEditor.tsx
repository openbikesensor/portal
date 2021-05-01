import React from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import {Divider, Message, Confirm, Grid, Button, Icon, Popup, Form, Ref, TextArea, Checkbox} from 'semantic-ui-react'
import {useHistory, useParams, Link} from 'react-router-dom'
import {concat, of, from} from 'rxjs'
import {pluck, distinctUntilChanged, map, switchMap} from 'rxjs/operators'
import {useObservable} from 'rxjs-hooks'
import {findInput} from 'utils'
import {useForm, Controller} from 'react-hook-form'

import api from 'api'
import {Page, FileUploadField} from 'components'
import type {Track} from 'types'

import {FileUploadStatus} from 'pages/UploadPage'

function ReplaceTrackData({slug}) {
  const [file, setFile] = React.useState(null)
  const [result, setResult] = React.useState(null)
  const onComplete = React.useCallback((_id, r) => setResult(r), [setResult])

  return (
    <>
      <h2>Replace track data</h2>
      {!file ? (
        <FileUploadField onSelect={setFile} />
      ) : result ? (
        <Message>
          Upload complete. <Link to={`/tracks/${slug}`}>Show track</Link>
        </Message>
      ) : (
        <FileUploadStatus {...{file, onComplete, slug}} />
      )}
    </>
  )
}

const TrackEditor = connect((state) => ({login: state.login}))(function TrackEditor({login}) {
  const [busy, setBusy] = React.useState(false)
  const {register, control, handleSubmit} = useForm()
  const {slug} = useParams()
  const history = useHistory()

  const track: null | Track = useObservable(
    (_$, args$) => {
      const slug$ = args$.pipe(pluck(0), distinctUntilChanged())
      return slug$.pipe(
        map((slug) => `/tracks/${slug}`),
        switchMap((url) => concat(of(null), from(api.get(url)))),
        pluck('track')
      )
    },
    null,
    [slug]
  )

  const loading = busy || track == null
  const isAuthor = login?.username === track?.author?.username

  // Navigate to track detials if we are not the author
  React.useEffect(() => {
    if (!login || (track && !isAuthor)) {
      history.replace(`/tracks/${slug}`)
    }
  }, [slug, login, track, isAuthor, history])

  const onSubmit = React.useMemo(
    () =>
      handleSubmit(async (values) => {
        setBusy(true)

        try {
          await api.put(`/tracks/${slug}`, {body: {track: _.pickBy(values, (v) => typeof v !== 'undefined')}})
          history.push(`/tracks/${slug}`)
        } finally {
          setBusy(false)
        }
      }),
    [slug, handleSubmit, history]
  )

  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const onDelete = React.useCallback(async () => {
    setBusy(true)

    try {
      await api.delete(`/tracks/${slug}`)
      history.push('/tracks')
    } finally {
      setConfirmDelete(false)
      setBusy(false)
    }
  }, [setBusy, setConfirmDelete, slug, history])

  return (
    <Page>
      <Grid centered relaxed divided>
        <Grid.Row>
          <Grid.Column width={10}>
            <h2>Edit {track ? track.title || 'Unnamed track' : 'track'}</h2>
            <Form loading={loading} key={track?.slug} onSubmit={onSubmit}>
              <Ref innerRef={findInput(register)}>
                <Form.Input label="Title" name="title" defaultValue={track?.title} style={{fontSize: '120%'}} />
              </Ref>

              <Form.Field>
                <label>Description</label>
                <Ref innerRef={register}>
                  <TextArea name="description" rows={4} defaultValue={track?.description} />
                </Ref>
              </Form.Field>

              <Form.Field>
                <label>Visibility</label>
                <Controller
                  name="public"
                  control={control}
                  defaultValue={track?.public}
                  render={(props) => (
                    <Checkbox
                      name="public"
                      label="Make track public (in track list and details page)"
                      checked={props.value}
                      onChange={(_, {checked}) => props.onChange(checked)}
                    />
                  )}
                />

                <Popup
                  wide="very"
                  content={
                    <>
                      <p>
                        Checking this box allows all users to see your full track. For your own privacy and security,
                        make sure to only publish tracks in this way that do not let others deduce where you live, work,
                        or frequently stay. Your recording device might have useful privacy settings to not record
                        geolocation data near those places.
                      </p>
                      <p>
                        In the future, this site will allow you to redact privacy sensitive data in tracks, both
                        manually and automatically. Until then, you will have to rely on the features of your recording
                        device, or manually redact your files before upload.
                      </p>
                      <p>
                        After checking this box, your data essentially becomes public. You understand that we cannot
                        control who potentially downloads this data and and keeps a copy, even if you delete it from
                        your account or anonymize it later.
                      </p>
                      <p>
                        <b>Use at your own risk.</b>
                      </p>
                    </>
                  }
                  trigger={<Icon name="warning sign" style={{marginLeft: 8}} color="orange" />}
                />
              </Form.Field>
              <Button type="submit">Save</Button>
            </Form>
          </Grid.Column>
          <Grid.Column width={6}>
            <ReplaceTrackData slug={slug} />

            <Divider />

            <h2>Danger zone</h2>
            <p>
              You can remove this track from your account and the portal if you like. However, if at any point you have
              published this track, we cannot guarantee that there are no versions of it in the public data repository,
              or any copy thereof.
            </p>
            <Button color="red" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <Confirm open={confirmDelete} onCancel={() => setConfirmDelete(false)} onConfirm={onDelete} />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Page>
  )
})

export default TrackEditor
