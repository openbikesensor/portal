import React, {useCallback, useMemo, useRef} from 'react'
import {useObservable} from 'rxjs-hooks'
import {concat, from, of, Subject} from 'rxjs'
import {Table, Button, Input} from 'semantic-ui-react'
import {useTranslation} from 'react-i18next'

import api from 'api'
import {UserDevice} from 'types'
import {startWith, switchMap} from 'rxjs/operators'

function EditField({value, onEdit}) {
  const [editing, setEditing] = React.useState(false)
  const [tempValue, setTempValue] = React.useState(value)
  const timeoutRef = useRef<null | number>(null)

  const cancelTimeout = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [timeoutRef])

  const abort = useCallback(() => {
    cancelTimeout()
    setEditing(false)
    setTempValue(value)
  }, [setEditing, setTempValue, value, cancelTimeout])

  const confirm = useCallback(() => {
    console.log('confirmed')
    cancelTimeout()
    setEditing(false)
    onEdit(tempValue)
  }, [setEditing, onEdit, tempValue, cancelTimeout])

  React.useEffect(() => {
    if (value !== tempValue) {
      setTempValue(value)
    }
  }, [value])

  if (editing) {
    return (
      <>
        <Input
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={(e) => {
            timeoutRef.current = setTimeout(abort, 20)
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              confirm()
            } else if (e.key === 'Escape') {
              abort()
            }
          }}
          style={{marginRight: 8}}
        />
      </>
    )
  } else {
    return (
      <>
        {value && <span style={{marginRight: 8}}>{value}</span>}
        <Button icon="edit" size="tiny" onClick={() => setEditing(true)} />
      </>
    )
  }
}

export default function DeviceList() {
  const {t} = useTranslation()
  const [loading_, setLoading] = React.useState(false)

  const trigger$ = useMemo(() => new Subject(), [])
  const devices: null | UserDevice[] = useObservable(() =>
    trigger$.pipe(
      startWith(null),
      switchMap(() => concat(of(null), from(api.get('/user/devices'))))
    )
  )

  const setDeviceDisplayName = useCallback(
    async (deviceId: number, displayName: string) => {
      setLoading(true)
      try {
        await api.put(`/user/devices/${deviceId}`, {body: {displayName}})
      } finally {
        setLoading(false)
        trigger$.next(null)
      }
    },
    [trigger$, setLoading]
  )

  const loading = devices == null || loading_

  return (
    <>
      <Table compact {...{loading}}>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={4}>{t('SettingsPage.devices.identifier')}</Table.HeaderCell>
            <Table.HeaderCell>{t('SettingsPage.devices.alias')}</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {devices?.map((device: UserDevice) => (
            <Table.Row key={device.id}>
              <Table.Cell> {device.identifier}</Table.Cell>
              <Table.Cell>
                <EditField
                  value={device.displayName}
                  onEdit={(displayName: string) => setDeviceDisplayName(device.id, displayName)}
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  )
}
