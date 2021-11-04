import _ from 'lodash'
import React from 'react'
import {List, Loader, Table, Icon} from 'semantic-ui-react'
import {Link} from 'react-router-dom'

import {FileUploadField, Page} from 'components'
import type {Track} from 'types'
import api from 'api'
import configPromise from 'config'

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

export function FileUploadStatus({
  id,
  file,
  onComplete,
  slug,
}: {
  id: string
  file: File
  onComplete: (result: FileUploadResult) => void
  slug?: string
}) {
  const [progress, setProgress] = React.useState(0)

  React.useEffect(
    () => {
      let xhr

      async function _work() {
        const formData = new FormData()
        formData.append('body', file)

        xhr = new XMLHttpRequest()
        xhr.withCredentials = true

        const onProgress = (e) => {
          const progress = (e.loaded || 0) / (e.total || 1)
          setProgress(progress)
        }

        const onLoad = (e) => {
          onComplete(id, xhr.response)
        }

        xhr.responseType = 'json'
        xhr.onload = onLoad
        xhr.upload.onprogress = onProgress

        const config = await configPromise
        if (slug) {
          xhr.open('PUT', `${config.apiUrl}/tracks/${slug}`)
        } else {
          xhr.open('POST', `${config.apiUrl}/tracks`)
        }

        // const accessToken = await api.getValidAccessToken()

        // xhr.setRequestHeader('Authorization', accessToken)
        xhr.send(formData)
      }

      _work()
      return () => xhr.abort()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [file]
  )

  return (
    <span>
      <Loader inline size="mini" active />{' '}
      {progress < 1 ? `Uploading ${(progress * 100).toFixed(0)}%` : 'Processing...'}
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
  const [files, setFiles] = React.useState<FileEntry[]>([])

  const onCompleteFileUpload = React.useCallback(
    (id, result) => {
      setFiles((files) => files.map((file) => (file.id === id ? {...file, result, file: null} : file)))
    },
    [setFiles]
  )

  function onSelectFiles(fileList) {
    const newFiles = Array.from(fileList).map((file) => ({
      id: 'file-' + String(Math.floor(Math.random() * 1000000)),
      file,
      name: file.name,
      size: file.size,
    }))
    setFiles(files.filter((a) => !newFiles.some((b) => isSameFile(a, b))).concat(newFiles))
  }

  return (
    <Page>
      {files.length ? (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Filename</Table.HeaderCell>
              <Table.HeaderCell>Size</Table.HeaderCell>
              <Table.HeaderCell>Status / Title</Table.HeaderCell>
              <Table.HeaderCell colSpan={2}></Table.HeaderCell>
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
                  ) : result ? (
                    <>
                      <Icon name="check" /> {result.track?.title || 'Unnamed track'}
                    </>
                  ) : (
                    <FileUploadStatus {...{id, file}} onComplete={onCompleteFileUpload} />
                  )}
                </Table.Cell>
                <Table.Cell>{result?.track ? <Link to={`/tracks/${result.track.slug}`}>Show</Link> : null}</Table.Cell>
                <Table.Cell>
                  {result?.track ? <Link to={`/tracks/${result.track.slug}/edit`}>Edit</Link> : null}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : null}

      <FileUploadField onSelect={onSelectFiles} multiple />
    </Page>
  )
}
