import _ from 'lodash'
import React from 'react'
import {List, Loader, Table, Icon, Segment, Header, Button} from 'semantic-ui-react'
import {Link} from 'react-router-dom'

import {FileDrop, Page} from 'components'
import type {Track} from 'types'
import api from 'api'

function isSameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`
  }

  bytes /= 1024

  if (bytes < 1024) {
    return `${bytes.toFixed(1)} KiB`
  }

  bytes /= 1024

  if (bytes < 1024) {
    return `${bytes.toFixed(1)} MiB`
  }

  bytes /= 1024
  return `${bytes.toFixed(1)} GiB`
}

type FileUploadResult =
  | {
      track: Track
    }
  | {
      errors: Record<string, string>
    }

function FileUploadStatus({
  id,
  file,
  onComplete,
}: {
  id: string
  file: File
  onComplete: (result: FileUploadResult) => void
}) {
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const formData = new FormData()
    formData.append('body', file)

    const xhr = new XMLHttpRequest()

    const onProgress = (e) => {
      console.log('progress', e)
      const progress = (e.loaded || 0) / (e.total || 1)
      setProgress(progress)
    }

    const onLoad = (e) => {
      console.log('loaded', e)
      onComplete(id, xhr.response)
    }

    xhr.responseType = 'json'
    xhr.onload = onLoad
    xhr.upload.onprogress = onProgress
    xhr.open('POST', '/api/tracks')
    xhr.setRequestHeader('Authorization', api.authorization)
    xhr.send(formData)

    return () => xhr.abort()
  }, [file])

  return (
    <span>
    <Loader inline size="mini" active />
    {' '}
    {progress < 1 ? (progress * 100).toFixed(0) + ' %' : 'Processing...'}
    </span>
  )
}

type FileEntry = {
  id: string
  file?: File | null
  size: number
  name: string
  result?: FileUploadResult
}

export default function UploadPage() {
  const labelRef = React.useRef()
  const [labelRefState, setLabelRefState] = React.useState()

  const [files, setFiles] = React.useState<FileEntry[]>([])

  const onCompleteFileUpload = React.useCallback(
    (id, result) => {
      setFiles((files) => files.map((file) => (file.id === id ? {...file, result, file: null} : file)))
    },
    [setFiles]
  )

  React.useLayoutEffect(() => {
    setLabelRefState(labelRef.current)
  }, [labelRef.current])

  function onSelectFiles(fileList) {
    console.log('UPLOAD', fileList)

    const newFiles = Array.from(fileList).map((file) => ({
      id: 'file-' + String(Math.floor(Math.random() * 1000000)),
      file,
      name: file.name,
      size: file.size,
    }))
    setFiles(files.filter((a) => !newFiles.some((b) => isSameFile(a, b))).concat(newFiles))
  }

  function onChangeField(e) {
    if (e.target.files && e.target.files.length) {
      onSelectFiles(e.target.files)
    }
    e.target.value = '' // reset the form field for uploading again
  }

  async function onDeleteTrack(slug: string) {
    await api.delete(`/tracks/${slug}`)
    setFiles((files) => files.filter((t) => t.result?.track?.slug !== slug))
  }

  return (
    <Page>
      {files.length ? (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Filename</Table.HeaderCell>
              <Table.HeaderCell>Size</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {files.map(({id, name, size, file, result}) => (
              <Table.Row key={id}>
                <Table.Cell>
                  <Icon name="file" />
                  {name}
                </Table.Cell>
                <Table.Cell>{formatFileSize(size)}</Table.Cell>
                <Table.Cell>
                  {result ? (
                    <>
                      <Icon name="check" /> Uploaded
                    </>
                  ) : (
                    <FileUploadStatus {...{id, file}} onComplete={onCompleteFileUpload} />
                  )}
                </Table.Cell>
                <Table.Cell>
                  {/* <pre>{JSON.stringify(result || null, null, 2)}</pre> */}
                  {result?.errors ? (
                    <List>
                      {_.sortBy(Object.entries(result.errors))
                        .filter(([field, message]) => typeof message === 'string')
                        .map(([field, message]) => (
                          <List.Item key={field}>
                            <List.Icon name="warning sign" color="red" />
                            <List.Content>{message}</List.Content>
                          </List.Item>
                        ))}
                    </List>
                  ) : null}
                </Table.Cell>
                <Table.Cell>
                  {result?.track ? (
                    <>
                      <Link to={`/tracks/${result.track.slug}`}>
                        <Button size="small" icon="arrow right" />
                      </Link>
                      <Button size="small" icon="trash" onClick={() => onDeleteTrack(result.track.slug)} />
                    </>
                  ) : null}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : null}

      <input
        type="file"
        id="upload-field"
        style={{width: 0, height: 0, position: 'fixed', left: -1000, top: -1000, opacity: 0.001}}
        multiple
        accept=".csv"
        onChange={onChangeField}
      />
      <label htmlFor="upload-field" ref={labelRef}>
        {labelRefState && (
          <FileDrop onDrop={onSelectFiles} frame={labelRefState}>
            {({draggingOverFrame, draggingOverTarget, onDragOver, onDragLeave, onDrop, onClick}) => (
              <Segment
                placeholder
                {...{onDragOver, onDragLeave, onDrop}}
                style={{
                  background: draggingOverTarget || draggingOverFrame ? '#E0E0EE' : null,
                  transition: 'background 0.2s',
                }}
              >
                <Header icon>
                  <Icon name="cloud upload" />
                  Drop files here or click to select them for upload
                </Header>

                <Button primary as="span">
                  Upload files
                </Button>
              </Segment>
            )}
          </FileDrop>
        )}
      </label>
    </Page>
  )
}
