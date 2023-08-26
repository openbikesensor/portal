import React, {useState, useCallback} from 'react'
import {pickBy} from 'lodash'
import {Loader, Statistic, Segment, Header, Menu} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {of, from, concat, combineLatest} from 'rxjs'
import {map, switchMap, distinctUntilChanged} from 'rxjs/operators'
import {Duration, DateTime} from 'luxon'
import {useTranslation} from 'react-i18next'

import api from 'api'

function formatDuration(seconds) {
  return (
    Duration.fromMillis((seconds ?? 0) * 1000)
      .as('hours')
      .toFixed(1) + ' h'
  )
}

export default function Stats({user = null}: {user?: null | string}) {
  const {t} = useTranslation()
  const [timeframe, setTimeframe] = useState('all_time')
  const onClick = useCallback((_e, {name}) => setTimeframe(name), [setTimeframe])

  const stats = useObservable(
    (_$, inputs$) => {
      const timeframe$ = inputs$.pipe(
        map((inputs) => inputs[0]),
        distinctUntilChanged()
      )

      const user$ = inputs$.pipe(
        map((inputs) => inputs[1]),
        distinctUntilChanged()
      )

      return combineLatest(timeframe$, user$).pipe(
        map(([timeframe_, user_]) => {
          const now = DateTime.now()

          let start, end

          switch (timeframe_) {
            case 'this_month':
              start = now.startOf('month')
              end = now.endOf('month')
              break

            case 'this_year':
              start = now.startOf('year')
              end = now.endOf('year')
              break
          }

          return pickBy({
            start: start?.toISODate(),
            end: end?.toISODate(),
            user: user_,
          })
        }),
        switchMap((query) => concat(of(null), from(api.get('/stats', {query}))))
      )
    },
    null,
    [timeframe, user]
  )

  const placeholder = t('Stats.placeholder')

  return (
    <>
      <div>
        <Segment attached="top">
          <Loader active={stats == null} />
          <Statistic.Group widths={2} size="tiny">
            <Statistic>
              <Statistic.Value>
                {stats ? `${Number(stats?.trackLength / 1000).toFixed(1)} km` : placeholder}
              </Statistic.Value>
              <Statistic.Label>{t('Stats.totalTrackLength')}</Statistic.Label>
            </Statistic>
            <Statistic>
              <Statistic.Value>{stats ? formatDuration(stats?.trackDuration) : placeholder}</Statistic.Value>
              <Statistic.Label>{t('Stats.timeRecorded')}</Statistic.Label>
            </Statistic>
            <Statistic>
              <Statistic.Value>{stats?.numEvents ?? placeholder}</Statistic.Value>
              <Statistic.Label>{t('Stats.eventsConfirmed')}</Statistic.Label>
            </Statistic>
            <Statistic>
              <Statistic.Value>{stats?.trackCount ?? placeholder}</Statistic.Value>
              <Statistic.Label>{t('Stats.tracksRecorded')}</Statistic.Label>
            </Statistic>
            {!user && (
              <>
                <Statistic>
                  <Statistic.Value>{stats?.userCount ?? placeholder}</Statistic.Value>
                  <Statistic.Label>{t('Stats.membersJoined')}</Statistic.Label>
                </Statistic>
                <Statistic>
                  <Statistic.Value>{stats?.deviceCount ?? placeholder}</Statistic.Value>
                  <Statistic.Label>{t('Stats.deviceCount')}</Statistic.Label>
                </Statistic>
              </>
            )}
          </Statistic.Group>
        </Segment>

        <Menu widths={3} attached="bottom" size="small">
          <Menu.Item name="this_month" active={timeframe === 'this_month'} onClick={onClick}>
            {t('Stats.thisMonth')}
          </Menu.Item>
          <Menu.Item name="this_year" active={timeframe === 'this_year'} onClick={onClick}>
            {t('Stats.thisYear')}
          </Menu.Item>
          <Menu.Item name="all_time" active={timeframe === 'all_time'} onClick={onClick}>
            {t('Stats.allTime')}
          </Menu.Item>
        </Menu>
      </div>
    </>
  )
}
