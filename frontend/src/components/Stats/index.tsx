import React, {useState, useCallback} from 'react'
import {pickBy} from 'lodash'
import {Loader, Statistic, Segment, Header, Menu} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {of, from, concat, combineLatest} from 'rxjs'
import {map, switchMap, distinctUntilChanged} from 'rxjs/operators'
import {Duration, DateTime} from 'luxon'

import api from 'api'

function formatDuration(seconds) {
  return (
    Duration.fromMillis((seconds ?? 0) * 1000)
      .as('hours')
      .toFixed(1) + ' h'
  )
}

export default function Stats({user = null}: {user?: null | string}) {
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

  return (
    <>
      <Header as="h2">Statistics</Header>

      <div>
        <Segment attached="top">
          <Loader active={stats == null} />
          <Statistic.Group widths={2} size="tiny">
            <Statistic>
              <Statistic.Value>{stats ? `${Number(stats?.trackLength / 1000).toFixed(1)} km` : '...'}</Statistic.Value>
              <Statistic.Label>Total xtrack length</Statistic.Label>
            </Statistic>
            <Statistic>
              <Statistic.Value>{stats ? formatDuration(stats?.trackDuration) : '...'}</Statistic.Value>
              <Statistic.Label>Time recorded</Statistic.Label>
            </Statistic>
            <Statistic>
              <Statistic.Value>{stats?.numEvents ?? '...'}</Statistic.Value>
              <Statistic.Label>Events confirmed</Statistic.Label>
            </Statistic>
            {user ? (
              <Statistic>
                <Statistic.Value>{stats?.trackCount ?? '...'}</Statistic.Value>
                <Statistic.Label>Tracks recorded</Statistic.Label>
              </Statistic>
            ) : (
              <Statistic>
                <Statistic.Value>{stats?.userCount ?? '...'}</Statistic.Value>
                <Statistic.Label>Members joined</Statistic.Label>
              </Statistic>
            )}
          </Statistic.Group>
        </Segment>

        <Menu widths={3} attached="bottom" size="small">
          <Menu.Item name="this_month" active={timeframe === 'this_month'} onClick={onClick}>
            This month
          </Menu.Item>
          <Menu.Item name="this_year" active={timeframe === 'this_year'} onClick={onClick}>
            This year
          </Menu.Item>
          <Menu.Item name="all_time" active={timeframe === 'all_time'} onClick={onClick}>
            All time
          </Menu.Item>
        </Menu>
      </div>
    </>
  )
}
