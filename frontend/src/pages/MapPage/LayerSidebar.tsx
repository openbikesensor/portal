import React from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import {Link} from 'react-router-dom'
import {List, Select, Input, Divider, Label, Checkbox, Header, Table} from 'semantic-ui-react'
import {useTranslation} from 'react-i18next'

import {
  MapConfig,
  setMapConfigFlag as setMapConfigFlagAction,
  initialState as defaultMapConfig,
} from 'reducers/mapConfig'
import {baseColormapSimpleHtml, GREEN, YELLOW, RED, COLORMAP_RURAL, COLORMAP_URBAN, COLORMAP_LEGAL} from 'mapstyles'
import {ColorMapLegend, DiscreteColorMapLegend} from 'components'
import styles from './styles.module.less'

const BASEMAP_STYLE_OPTIONS = ['positron', 'bright', 'darkmatter']

const ROAD_ATTRIBUTE_OPTIONS = [
  'distance_overtaker_mean',
  'distance_overtaker_min',
  'distance_overtaker_max',
  'distance_overtaker_median',
  'overtaking_event_count',
  'usage_count',
  // 'segment_length', // this doens't make much sense to show on the map
  'zone',
  'overtaking_frequency',
  'overtaking_legality',
  'combined_score',
]

const DATE_FILTER_MODES = ['none', 'range', 'threshold']

type User = Object

function LayerSidebar({
  mapConfig,
  login,
  setMapConfigFlag,
}: {
  login: User | null
  mapConfig: MapConfig
  setMapConfigFlag: (flag: string, value: unknown) => void
}) {
  const {t} = useTranslation()
  const {
    baseMap: {style},
    obsRoads: {show: showRoads, showUntagged, attribute, maxCount},
    obsEvents: {show: showEvents},
    obsRegions: {show: showRegions},
    obsTracks: {show: showTracks},
    filters: {currentUser: filtersCurrentUser, dateMode, startDate, endDate, thresholdAfter},
  } = mapConfig

  const openStreetMapCopyright = (
    <List.Item className={styles.copyright}>
      {t('MapPage.sidebar.copyright.openStreetMap')}{' '}
      <Link to="/acknowledgements">{t('MapPage.sidebar.copyright.learnMore')}</Link>
    </List.Item>
  )

  return (
    <div>
      <List relaxed>
        <List.Item>
          <List.Header>{t('MapPage.sidebar.baseMap.style.label')}</List.Header>
          <Select
            options={BASEMAP_STYLE_OPTIONS.map((value) => ({
              value,
              key: value,
              text: t(`MapPage.sidebar.baseMap.style.${value}`),
            }))}
            value={style}
            onChange={(_e, {value}) => setMapConfigFlag('baseMap.style', value)}
          />
        </List.Item>
        {openStreetMapCopyright}
        <Divider />
        <List.Item>
          <Checkbox
            toggle
            size="small"
            id="obsRegions.show"
            style={{float: 'right'}}
            checked={showRegions}
            onChange={() => setMapConfigFlag('obsRegions.show', !showRegions)}
          />
          <label htmlFor="obsRegions.show">
            <Header as="h4">{t('MapPage.sidebar.obsRegions.title')}</Header>
          </label>
        </List.Item>
        {showRegions && (
          <>
            <List.Item>{t('MapPage.sidebar.obsRegions.colorByEventCount')}</List.Item>
            <List.Item>
              <ColorMapLegend start="0" end="5000" map={['#00897B00', '#00897BFF']} />
            </List.Item>
            <List.Item className={styles.copyright}>
              {t('MapPage.sidebar.copyright.boundaries')}{' '}
              <Link to="/acknowledgements">{t('MapPage.sidebar.copyright.learnMore')}</Link>
            </List.Item>
          </>
        )}
        <Divider />
        <List.Item>
          <Checkbox
            toggle
            size="small"
            id="obsRoads.show"
            style={{float: 'right'}}
            checked={showRoads}
            onChange={() => setMapConfigFlag('obsRoads.show', !showRoads)}
          />
          <label htmlFor="obsRoads.show">
            <Header as="h4">{t('MapPage.sidebar.obsRoads.title')}</Header>
          </label>
        </List.Item>
        {showRoads && (
          <>
            <List.Item>
              <Checkbox
                checked={showUntagged}
                onChange={() => setMapConfigFlag('obsRoads.showUntagged', !showUntagged)}
                label={t('MapPage.sidebar.obsRoads.showUntagged.label')}
              />
            </List.Item>
            <List.Item>
              <List.Header>{t('MapPage.sidebar.obsRoads.attribute.label')}</List.Header>
              <Select
                fluid
                options={ROAD_ATTRIBUTE_OPTIONS.map((value) => ({
                  value,
                  key: value,
                  text: t(`MapPage.sidebar.obsRoads.attribute.${value}`),
                }))}
                value={attribute}
                onChange={(_e, {value}) => setMapConfigFlag('obsRoads.attribute', value)}
              />
            </List.Item>

            {attribute === 'combined_score' && (
              <List.Item>
                <List.Header>{t('MapPage.sidebar.obsRoads.combinedScore.label')}</List.Header>
                <ScoreTable />
                <p>{t('MapPage.sidebar.obsRoads.combinedScore.description')}</p>
              </List.Item>
            )}

            {attribute === 'overtaking_frequency' && (
              <>
                <List.Item>
                  <ColorMapLegend map={baseColormapSimpleHtml} start="0/km" end="10/km" />
                </List.Item>
              </>
            )}

            {attribute === 'overtaking_legality' && (
              <>
                <List.Item>
                  <DiscreteColorMapLegend
                    map={COLORMAP_LEGAL}
                    renderValue={(x) => (x * 100).toFixed(0) + ' %'}
                    min={0}
                    max={1}
                  />
                </List.Item>
              </>
            )}

            {(attribute === 'usage_count' || attribute === 'overtaking_event_count') && (
              <>
                <List.Item style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                  <ColorMapLegend map={baseColormapSimpleHtml} start="0" end="" />
                  <Input
                    type="number"
                    value={maxCount}
                    size="small"
                    style={{width: '10ch', marginRight: 10, marginTop: -11}}
                    onChange={(_e, {value}) => setMapConfigFlag('obsRoads.maxCount', value)}
                  />
                </List.Item>
              </>
            )}

            {attribute === 'zone' && (
              <>
                <List.Item>
                  <Label size="small" style={{background: 'blue', color: 'white'}}>
                    {t('general.zone.urban')} (1.5&nbsp;m)
                  </Label>
                  <Label size="small" style={{background: 'cyan', color: 'black'}}>
                    {t('general.zone.rural')}(2&nbsp;m)
                  </Label>
                </List.Item>
              </>
            )}
            {attribute.startsWith('distance_') && (
              <>
                <List.Item>
                  <List.Header>{_.upperFirst(t('general.zone.urban'))}</List.Header>
                  <DiscreteColorMapLegend map={COLORMAP_URBAN} />
                </List.Item>
                <List.Item>
                  <List.Header>{_.upperFirst(t('general.zone.rural'))}</List.Header>
                  <DiscreteColorMapLegend map={COLORMAP_RURAL} />
                </List.Item>
              </>
            )}

            {openStreetMapCopyright}
          </>
        )}
        <Divider />
        <List.Item>
          <Checkbox
            toggle
            size="small"
            id="obsEvents.show"
            style={{float: 'right'}}
            checked={showEvents}
            onChange={() => setMapConfigFlag('obsEvents.show', !showEvents)}
          />
          <label htmlFor="obsEvents.show">
            <Header as="h4">{t('MapPage.sidebar.obsEvents.title')}</Header>
          </label>
        </List.Item>
        {showEvents && (
          <>
            <List.Item>
              <List.Header>{_.upperFirst(t('general.zone.urban'))}</List.Header>
              <DiscreteColorMapLegend map={COLORMAP_URBAN} />
            </List.Item>
            <List.Item>
              <List.Header>{_.upperFirst(t('general.zone.rural'))}</List.Header>
              <DiscreteColorMapLegend map={COLORMAP_RURAL} />
            </List.Item>
          </>
        )}
        <Divider />

        {filtersCurrentUser && login && (
          <>
            <List.Item>
              <Checkbox
                toggle
                size="small"
                id="obsTracks.show"
                style={{float: 'right'}}
                checked={showTracks}
                onChange={() => setMapConfigFlag('obsTracks.show', !showTracks)}
              />
              <label htmlFor="obsTracks.show">
                <Header as="h4">{t('MapPage.sidebar.obsTracks.title')}</Header>
              </label>
            </List.Item>
            <Divider />
          </>
        )}

        <List.Item>
          <Header as="h4">{t('MapPage.sidebar.filters.title')}</Header>
        </List.Item>

        {login && (
          <>
            <List.Item>
              <Header as="h5">{t('MapPage.sidebar.filters.userData')}</Header>
            </List.Item>

            <List.Item>
              <Checkbox
                toggle
                size="small"
                id="filters.currentUser"
                checked={filtersCurrentUser}
                onChange={() => setMapConfigFlag('filters.currentUser', !filtersCurrentUser)}
                label={t('MapPage.sidebar.filters.currentUser')}
              />
            </List.Item>

            <List.Item>
              <Header as="h5">{t('MapPage.sidebar.filters.dateRange')}</Header>
            </List.Item>

            <List.Item>
              <Select
                id="filters.dateMode"
                options={DATE_FILTER_MODES.map((value) => ({
                  value,
                  key: value,
                  text: t(`MapPage.sidebar.filters.dateMode.${value}`),
                }))}
                value={dateMode ?? 'none'}
                onChange={(_e, {value}) => setMapConfigFlag('filters.dateMode', value)}
              />
            </List.Item>

            {dateMode == 'range' && (
              <List.Item>
                <Input
                  type="date"
                  min="2000-01-03"
                  step="7"
                  size="small"
                  id="filters.startDate"
                  onChange={(_e, {value}) => setMapConfigFlag('filters.startDate', value)}
                  value={startDate ?? null}
                  label={t('MapPage.sidebar.filters.start')}
                />
              </List.Item>
            )}

            {dateMode == 'range' && (
              <List.Item>
                <Input
                  type="date"
                  min="2000-01-03"
                  step="7"
                  size="small"
                  id="filters.endDate"
                  onChange={(_e, {value}) => setMapConfigFlag('filters.endDate', value)}
                  value={endDate ?? null}
                  label={t('MapPage.sidebar.filters.end')}
                />
              </List.Item>
            )}

            {dateMode == 'threshold' && (
              <List.Item>
                <Input
                  type="date"
                  min="2000-01-03"
                  step="7"
                  size="small"
                  id="filters.startDate"
                  value={startDate ?? null}
                  onChange={(_e, {value}) => setMapConfigFlag('filters.startDate', value)}
                  label={t('MapPage.sidebar.filters.threshold')}
                />
              </List.Item>
            )}

            {dateMode == 'threshold' && (
              <List.Item>
                <span>
                  {t('MapPage.sidebar.filters.before')}{' '}
                  <Checkbox
                    toggle
                    size="small"
                    checked={thresholdAfter ?? false}
                    onChange={() => setMapConfigFlag('filters.thresholdAfter', !thresholdAfter)}
                    id="filters.thresholdAfter"
                  />{' '}
                  {t('MapPage.sidebar.filters.after')}
                </span>
              </List.Item>
            )}
          </>
        )}
        {!login && <List.Item>{t('MapPage.sidebar.filters.needsLogin')}</List.Item>}
      </List>
    </div>
  )
}

function ScoreTable() {
  const border = '1px solid white'
  return (
    <Table size="small" compact border>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width="four"></Table.HeaderCell>
          <Table.HeaderCell width="four">&le;&nbsp;3/km</Table.HeaderCell>
          <Table.HeaderCell width="four">&le;&nbsp;6/km</Table.HeaderCell>
          <Table.HeaderCell width="four">&gt;&nbsp;6/km</Table.HeaderCell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell>&le;&nbsp;25%</Table.HeaderCell>
          <Table.Cell style={{border, backgroundColor: GREEN}}></Table.Cell>
          <Table.Cell style={{border, backgroundColor: GREEN}}></Table.Cell>
          <Table.Cell style={{border, backgroundColor: YELLOW}}></Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell>&le;&nbsp;50%</Table.HeaderCell>
          <Table.Cell style={{border, backgroundColor: GREEN}}></Table.Cell>
          <Table.Cell style={{border, backgroundColor: YELLOW}}></Table.Cell>
          <Table.Cell style={{border, backgroundColor: RED}}></Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell>&le;&nbsp;75%</Table.HeaderCell>
          <Table.Cell style={{border, backgroundColor: YELLOW}}></Table.Cell>
          <Table.Cell style={{border, backgroundColor: RED}}></Table.Cell>
          <Table.Cell style={{border, backgroundColor: RED}}></Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell>&gt;&nbsp;75%</Table.HeaderCell>
          <Table.Cell style={{border, backgroundColor: YELLOW}}></Table.Cell>
          <Table.Cell style={{border, backgroundColor: RED}}></Table.Cell>
          <Table.Cell style={{border, backgroundColor: RED}}></Table.Cell>
        </Table.Row>
      </Table.Header>
    </Table>
  )
}

export default connect(
  (state) => ({
    mapConfig: _.merge(
      {},
      defaultMapConfig,
      (state as any).mapConfig as MapConfig
      //
    ),
    login: state.login,
  }),
  {setMapConfigFlag: setMapConfigFlagAction}
  //
)(LayerSidebar)
