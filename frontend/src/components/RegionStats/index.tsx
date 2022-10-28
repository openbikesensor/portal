import React, { useState, useCallback } from "react";
import { pickBy } from "lodash";
import {
  Loader,
  Statistic,
  Pagination,
  Segment,
  Header,
  Menu,
  Table,
  Icon,
} from "semantic-ui-react";
import { useObservable } from "rxjs-hooks";
import { of, from, concat, combineLatest } from "rxjs";
import { map, switchMap, distinctUntilChanged } from "rxjs/operators";
import { Duration, DateTime } from "luxon";
import {useTranslation} from 'react-i18next'

import api from "api";

function formatDuration(seconds) {
  return (
    Duration.fromMillis((seconds ?? 0) * 1000)
      .as("hours")
      .toFixed(1) + " h"
  );
}

export default function Stats() {
  const {t} = useTranslation()

  const [page, setPage] = useState(1);
  const PER_PAGE = 10;
  const stats = useObservable(
    () =>
      of(null).pipe(
        switchMap(() => concat(of(null), from(api.get("/stats/regions"))))
      ),
    null
  );

  const pageCount = stats ? Math.ceil(stats.length / PER_PAGE) : 1;

  return (
    <>
      <Header as="h2">{t(`Stats.topRegions`)}</Header>

      <div>
        <Loader active={stats == null} />

        <Table celled>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t(`Stats.regionName`)}</Table.HeaderCell>
              <Table.HeaderCell>{t(`Stats.eventCount`)}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {stats
              ?.slice((page - 1) * PER_PAGE, page * PER_PAGE)
              ?.map((area) => (
                <Table.Row key={area.id}>
                  <Table.Cell>{area.name}</Table.Cell>
                  <Table.Cell>{area.overtaking_event_count}</Table.Cell>
                </Table.Row>
              ))}
          </Table.Body>

    {pageCount > 1 && <Table.Footer>
            <Table.Row>
              <Table.HeaderCell colSpan="2">
                <Pagination
                  floated="right"
                  activePage={page}
                  totalPages={pageCount}
                  onPageChange={(e, data) => setPage(data.activePage as number)}
                />
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>}
        </Table>
      </div>
    </>
  );
}
