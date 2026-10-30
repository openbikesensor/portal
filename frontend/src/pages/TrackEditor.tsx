import React from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import {
  Divider,
  Message,
  Confirm,
  Grid,
  Button,
  Icon,
  Popup,
  Form,
  Ref,
  TextArea,
  Checkbox,
  Header,
} from 'semantic-ui-react'
import {useNavigate, useParams, Link} from 'react-router-dom'
import {concat, of, from, distinctUntilChanged, map, switchMap} from 'rxjs'
import {useObservable} from 'rxjs-hooks'
import {findInput} from 'utils'
import {useForm, Controller} from 'react-hook-form'
import {useTranslation, Trans as Translate} from 'react-i18next'
import Markdown from 'react-markdown'

import api from 'api'
import {Page, FileUploadField} from 'components'
import type {Track} from 'types'

import {FileUploadStatus} from 'pages/UploadPage'

function ReplaceTrackData({slug}) {
  const {t} = useTranslation()
  const [file, setFile] = React.useState(null)
  const [result, setResult] = React.useState(null)
  const onComplete = React.useCallback((_id, r) => setResult(r), [setResult])

  return (
    <>
      <Header as="h2">{t('TrackEditor.replaceTrackData')}</Header>
      {!file ? (
        <FileUploadField onSelect={setFile} />
      ) : result ? (
        <Message>
          <Translate i18nKey="TrackEditor.uploadComplete">
            Upload complete. <Link to={`/tracks/${slug}`}>Show track</Link>
          </Translate>
        </Message>
      ) : (
        <FileUploadStatus {...{file, onComplete, slug}} />
      )}
    </>
  )
}

const TrackEditor = connect((state: any) => ({login: state.login}))(function TrackEditor({login}: {login?: any}) {
  const {t} = useTranslation()
  const [busy, setBusy] = React.useState(false)
  const {register, control, handleSubmit} = useForm()
  const {slug} = useParams()
  const navigate = useNavigate()

  const track: null | Track = useObservable(
    (_$, args$) => {
      const slug$ = args$.pipe(
        map((args) => args[0]),
        distinctUntilChanged()
      )
      return slug$.pipe(
        map((slug) => `/tracks/${slug}`),
        switchMap((url) => concat(of(null), from(api.get(url)))),
        map((res: any) => res?.track)
      )
    },
    null,
    [slug]
  )

  const loading = busy || track == null
  const isAuthor = login?.id === track?.author?.id

  // Navigate to track detials if we are not the author
  React.useEffect(() => {
    if (!login || (track && !isAuthor)) {
      navigate(`/tracks/${slug}`, {replace: true})
    }
  }, [slug, login, track, isAuthor, navigate])

  const onSubmit = React.useMemo(
    () =>
      handleSubmit(async (values) => {
        setBusy(true)

        try {
          await api.put(`/tracks/${slug}`, {
            body: {
              track: _.pickBy(values, (v) => typeof v !== 'undefined'),
            },
          })
          navigate(`/tracks/${slug}`)
        } finally {
          setBusy(false)
        }
      }),
    [slug, handleSubmit, navigate]
  )

  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const onDelete = React.useCallback(async () => {
    setBusy(true)

    try {
      await api.delete(`/tracks/${slug}`)
      navigate('/tracks')
    } finally {
      setConfirmDelete(false)
      setBusy(false)
    }
  }, [setBusy, setConfirmDelete, slug, navigate])

  const trackTitle: string = track?.title || t('general.unnamedTrack')
  const title = t('TrackEditor.title', {trackTitle})

  return (
    <Page title={title}>
      <Grid centered relaxed divided stackable>
        <Grid.Row>
          <Grid.Column width={10}>
            <Header as="h2">{title}</Header>
            <Form loading={loading} key={track?.slug} onSubmit={onSubmit}>
              <Ref innerRef={findInput(register('title'))}>
                <Form.Input {...register('title')} label="Title" defaultValue={track?.title} style={{fontSize: '120%'}} />
              </Ref>

              <Form.Field>
                <label>{t('TrackEditor.description.label')}</label>
                <Ref innerRef={findInput(register('description'))}>
                  <TextArea {...register('description')} rows={4} defaultValue={track?.description} />
                </Ref>
              </Form.Field>

              <Form.Field>
                <label>
                  {t('TrackEditor.visibility.label')}
                  <Popup
                    wide="very"
                    content={<Markdown>{t('TrackEditor.visibility.description')}</Markdown>}
                    trigger={<Icon name="warning sign" style={{marginLeft: 8}} color="orange" />}
                  />
                </label>

                <Controller
                  name="public"
                  control={control}
                  defaultValue={track?.public}
                  render={({field: {value, onChange}}) => (
                    <Checkbox
                      name="public"
                      label={t('TrackEditor.visibility.checkboxLabel')}
                      checked={value}
                      onChange={(_, {checked}) => onChange(checked)}
                    />
                  )}
                />
              </Form.Field>
              <Button type="submit">{t('general.save')}</Button>
            </Form>
          </Grid.Column>
          <Grid.Column width={6}>
            <ReplaceTrackData slug={slug} />

            <Divider />

            <Header as="h2">{t('TrackEditor.dangerZone.title')}</Header>
            <Markdown>{t('TrackEditor.dangerZone.description')}</Markdown>

            <Button color="red" onClick={() => setConfirmDelete(true)}>
              {t('general.delete')}
            </Button>
            <Confirm
              open={confirmDelete}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={onDelete}
              content={t('TrackEditor.dangerZone.confirmDelete')}
              confirmButton={t('general.delete')}
              cancelButton={t('general.cancel')}
            />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Page>
  )
})

export default TrackEditor
