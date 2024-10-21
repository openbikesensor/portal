import React, {useState, useCallback, useMemo} from 'react'
import {Source, Layer} from 'react-map-gl'
import _ from 'lodash'
import {Button, Form, Dropdown, Header, Message, Icon, Checkbox} from 'semantic-ui-react'
import {useTranslation, Trans as Translate} from 'react-i18next'
import Markdown from 'react-markdown'

import {useConfig} from 'config'
import {Page, Map} from 'components'

const BoundingBoxSelector = React.forwardRef(({value, name, onChange}, ref) => {
  const {t} = useTranslation()
  const [pointNum, setPointNum] = useState(0)
  const [point0, setPoint0] = useState(null)
  const [point1, setPoint1] = useState(null)

  const onClick = (e) => {
    if (pointNum == 0) {
      setPoint0(e.lngLat)
    } else {
      setPoint1(e.lngLat)
    }
    setPointNum(1 - pointNum)
  }

  React.useEffect(() => {
    if (!point0 || !point1) return
    const bbox = `${point0[0]},${point0[1]},${point1[0]},${point1[1]}`
    if (bbox !== value) {
      onChange(bbox)
    }
  }, [point0, point1])

  React.useEffect(() => {
    if (!value) return
    const [p00, p01, p10, p11] = value.split(',').map((v) => Number.parseFloat(v))
    if (!point0 || point0[0] != p00 || point0[1] != p01) setPoint0([p00, p01])
    if (!point1 || point1[0] != p10 || point1[1] != p11) setPoint1([p10, p11])
  }, [value])

  return (
    <div>
      <Form.Input
        label={t('ExportPage.boundingBox.label')}
        {...{name, value}}
        onChange={(e) => onChange(e.target.value)}
      />

      <div style={{height: 400, position: 'relative', marginBottom: 16}}>
        <Map onClick={onClick}>
          <Source
            id="bbox"
            type="geojson"
            data={
              point0 && point1
                ? {
                    type: 'FeatureCollection',
                    features: [
                      {
                        type: 'Feature',
                        geometry: {
                          type: 'Polygon',
                          coordinates: [
                            [
                              [point0[0], point0[1]],
                              [point1[0], point0[1]],
                              [point1[0], point1[1]],
                              [point0[0], point1[1]],
                              [point0[0], point0[1]],
                            ],
                          ],
                        },
                      },
                    ],
                  }
                : {}
            }
          >
            <Layer
              id="bbox"
              type="line"
              paint={{
                'line-width': 4,
                'line-color': '#F06292',
              }}
            />
          </Source>
        </Map>
      </div>
    </div>
  )
})

const MODES = ['events', 'segments']
const FORMATS = ['geojson', 'shapefile']

export default function ExportPage() {
  const [mode, setMode] = useState('events')
  const [snap, setSnap] = useState('snap')

  const [bbox, setBbox] = useState('8.294678,49.651182,9.059601,50.108249')
  const [fmt, setFmt] = useState('geojson')
  const config = useConfig()
  const {t} = useTranslation()
  return (
    <Page title="Export">
      <Header as="h2">{t('ExportPage.title')}</Header>

      <Message icon info>
        <Icon name="info circle" />
        <Message.Content>
          <Markdown>{t('ExportPage.information')}</Markdown>
        </Message.Content>
      </Message>

      <Form>
        <Form.Field>
          <label>{t('ExportPage.mode.label')}</label>
          <Dropdown
            placeholder={t('ExportPage.mode.placeholder')}
            fluid
            selection
            options={MODES.map((value) => ({
              key: value,
              text: t(`ExportPage.mode.${value}`),
              value,
            }))}
            value={mode}
            onChange={(_e, {value}) => setMode(value)}
          />
        </Form.Field>
        <Form.Field>
        <Checkbox
          label={t('ExportPage.snapping')}
          name="snap"
          value="true"
          onChange={(_e, {value}) => setSnap(!snap)}

        />
        </Form.Field>


        <Form.Field>
          <label>{t('ExportPage.format.label')}</label>
          <Dropdown
            placeholder={t('ExportPage.format.placeholder')}
            fluid
            selection
            options={FORMATS.map((value) => ({
              key: value,
              text: t(`ExportPage.format.${value}`),
              value,
            }))}
            value={fmt}
            onChange={(_e, {value}) => setFmt(value)}
          />
        </Form.Field>

        <BoundingBoxSelector value={bbox} onChange={setBbox} />

        <Button
          primary
          as="a"
          href={`${config?.apiUrl}/export/${mode}?bbox=${bbox}&fmt=${fmt}&snap=${snap}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('ExportPage.export')}
        </Button>
      </Form>
    </Page>
  )
}
