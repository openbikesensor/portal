import React, { useCallback, useMemo, useState } from "react";
import { connect } from "react-redux";
import {
  Accordion,
  Button,
  Checkbox,
  Confirm,
  Header,
  Icon,
  Item,
  List,
  Loader,
  Dropdown,
  SemanticCOLORS,
  SemanticICONS,
  Table,
} from "semantic-ui-react";
import { useObservable } from "rxjs-hooks";
import { Link } from "react-router-dom";
import { of, from, concat, BehaviorSubject, combineLatest } from "rxjs";
import { map, switchMap, distinctUntilChanged } from "rxjs/operators";
import _ from "lodash";
import { useTranslation } from "react-i18next";

import type { ProcessingStatus, Track, UserDevice } from "types";
import { Page, FormattedDate, Visibility } from "components";
import api from "api";
import { useCallbackRef, formatDistance, formatDuration } from "utils";

import download from "downloadjs";

const COLOR_BY_STATUS: Record<ProcessingStatus, SemanticCOLORS> = {
  error: "red",
  complete: "green",
  created: "grey",
  queued: "orange",
  processing: "orange",
};

const ICON_BY_STATUS: Record<ProcessingStatus, SemanticICONS> = {
  error: "warning sign",
  complete: "check circle outline",
  created: "bolt",
  queued: "bolt",
  processing: "bolt",
};

function ProcessingStatusLabel({ status }: { status: ProcessingStatus }) {
  const { t } = useTranslation();
  return (
    <span title={t(`TracksPage.processing.${status}`)}>
      <Icon color={COLOR_BY_STATUS[status]} name={ICON_BY_STATUS[status]} />
    </span>
  );
}

function SortableHeader({
  children,
  setOrderBy,
  orderBy,
  reversed,
  setReversed,
  name,
  ...props
}) {
  const toggleSort = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (orderBy === name) {
      if (!reversed) {
        setReversed(true);
      } else {
        setReversed(false);
        setOrderBy(null);
      }
    } else {
      setReversed(false);
      setOrderBy(name);
    }
  };

  let icon =
    orderBy === name ? (reversed ? "sort descending" : "sort ascending") : null;

  return (
    <Table.HeaderCell {...props}>
      <div onClick={toggleSort}>
        {children}
        <Icon name={icon} />
      </div>
    </Table.HeaderCell>
  );
}

type Filters = {
  userDeviceId?: null | number;
  visibility?: null | boolean;
};

function TrackFilters({
  filters,
  setFilters,
  deviceNames,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  deviceNames: null | Record<number, string>;
}) {
  return (
    <List horizontal>
      <List.Item>
        <List.Header>Device</List.Header>
        <Dropdown
          selection
          clearable
          options={[
            { value: 0, key: "__none__", text: "All my devices" },
            ..._.sortBy(Object.entries(deviceNames ?? {}), 1).map(
              ([deviceId, deviceName]: [string, string]) => ({
                value: Number(deviceId),
                key: deviceId,
                text: deviceName,
              })
            ),
          ]}
          value={filters?.userDeviceId ?? 0}
          onChange={(_e, { value }) =>
            setFilters({ ...filters, userDeviceId: (value as number) || null })
          }
        />
      </List.Item>

      <List.Item>
        <List.Header>Visibility</List.Header>
        <Dropdown
          selection
          clearable
          options={[
            { value: "none", key: "any", text: "Any" },
            { value: true, key: "public", text: "Public" },
            { value: false, key: "private", text: "Private" },
          ]}
          value={filters?.visibility ?? "none"}
          onChange={(_e, { value }) =>
            setFilters({
              ...filters,
              visibility: value === "none" ? null : (value as boolean),
            })
          }
        />
      </List.Item>
    </List>
  );
}

function TracksTable({ title }) {
  const [orderBy, setOrderBy] = useState("recordedAt");
  const [reversed, setReversed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [selectedTracks, setSelectedTracks] = useState<Record<string, boolean>>(
    {}
  );

  const toggleTrackSelection = useCallbackRef(
    (slug: string, selected?: boolean) => {
      const newSelected = selected ?? !selectedTracks[slug];
      setSelectedTracks(
        _.pickBy({ ...selectedTracks, [slug]: newSelected }, _.identity)
      );
    }
  );

  const query = _.pickBy(
    {
      limit: 1000,
      offset: 0,
      order_by: orderBy,
      reversed: reversed ? "true" : "false",
      user_device_id: filters?.userDeviceId,
      public: filters?.visibility,
    },
    (x) => x != null
  );

  const forceUpdate$ = useMemo(() => new BehaviorSubject(null), []);
  const tracks: Track[] | null = useObservable(
    (_$, inputs$) =>
      combineLatest([
        inputs$.pipe(
          map(([query]) => query),
          distinctUntilChanged(_.isEqual)
        ),
        forceUpdate$,
      ]).pipe(
        switchMap(([query]) =>
          concat(
            of(null),
            from(api.get("/tracks/feed", { query }).then((r) => r.tracks))
          )
        )
      ),
    null,
    [query]
  );

  const deviceNames: null | Record<number, string> = useObservable(() =>
    from(api.get("/user/devices")).pipe(
      map((response: UserDevice[]) =>
        Object.fromEntries(
          response.map((device) => [
            device.id,
            device.displayName || device.identifier,
          ])
        )
      )
    )
  );

  const { t } = useTranslation();

  const p = { orderBy, setOrderBy, reversed, setReversed };

  const selectedCount = Object.keys(selectedTracks).length;
  const noneSelected = selectedCount === 0;
  const allSelected = selectedCount === tracks?.length;
  const selectAll = () => {
    setSelectedTracks(
      Object.fromEntries(tracks?.map((t) => [t.slug, true]) ?? [])
    );
  };
  const selectNone = () => {
    setSelectedTracks({});
  };

  const bulkAction = async (action: string) => {
    const response = await api.post("/tracks/bulk", {
      body: {
        action,
        tracks: Object.keys(selectedTracks),
      },
      returnResponse: true,
    });
    if (action === "download") {
      const contentType =
        response.headers.get("content-type") ?? "application/x-gtar";

      const filename =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "tracks.tar.bz2";
      download(await response.blob(), filename, contentType);
    }

    setShowBulkDelete(false);
    setSelectedTracks({});
    forceUpdate$.next(null);
  };
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  return (
    <>
      <div style={{ float: "right" }}>
        <Dropdown disabled={noneSelected} text="Bulk actions" floating button>
          <Dropdown.Menu>
            <Dropdown.Header>
              Selection of {selectedCount} tracks
            </Dropdown.Header>
            <Dropdown.Item onClick={() => bulkAction("makePrivate")}>
              Make private
            </Dropdown.Item>
            <Dropdown.Item onClick={() => bulkAction("makePublic")}>
              Make public
            </Dropdown.Item>
            <Dropdown.Item onClick={() => bulkAction("reprocess")}>
              Reprocess
            </Dropdown.Item>
            <Dropdown.Item onClick={() => bulkAction("download")}>
              Download
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setShowBulkDelete(true)}>
              Delete
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        <Link component={UploadButton} to="/upload" />
      </div>

      <Header as="h1">{title}</Header>
      <div style={{ clear: "both" }}>
        <Loader content={t("general.loading")} active={tracks == null} />

        <Accordion>
          <Accordion.Title
            active={showFilters}
            index={0}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Icon name="dropdown" />
            Filters
          </Accordion.Title>
          <Accordion.Content active={showFilters}>
            <TrackFilters {...{ filters, setFilters, deviceNames }} />
          </Accordion.Content>
        </Accordion>

        <Confirm
          open={showBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
          onConfirm={() => bulkAction("delete")}
          content={`Are you sure you want to delete ${selectedCount} tracks?`}
          confirmButton={t("general.delete")}
          cancelButton={t("general.cancel")}
        />

        <Table compact>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && !noneSelected}
                  onClick={() => (noneSelected ? selectAll() : selectNone())}
                />
              </Table.HeaderCell>

              <SortableHeader {...p} name="title">
                Title
              </SortableHeader>
              <SortableHeader {...p} name="recordedAt">
                Recorded at
              </SortableHeader>
              <SortableHeader {...p} name="visibility">
                Visibility
              </SortableHeader>
              <SortableHeader {...p} name="length" textAlign="right">
                Length
              </SortableHeader>
              <SortableHeader {...p} name="duration" textAlign="right">
                Duration
              </SortableHeader>
              <SortableHeader {...p} name="user_device_id">
                Device
              </SortableHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {tracks?.map((track: Track) => (
              <Table.Row key={track.slug}>
                <Table.Cell>
                  <Checkbox
                    onClick={(e) => toggleTrackSelection(track.slug)}
                    checked={selectedTracks[track.slug] ?? false}
                  />
                </Table.Cell>
                <Table.Cell>
                  {track.processingStatus == null ? null : (
                    <ProcessingStatusLabel status={track.processingStatus} />
                  )}
                  <Item.Header as={Link} to={`/tracks/${track.slug}`}>
                    {track.title || t("general.unnamedTrack")}
                  </Item.Header>
                </Table.Cell>

                <Table.Cell>
                  <FormattedDate date={track.recordedAt} />
                </Table.Cell>

                <Table.Cell>
                  {track.public == null ? null : (
                    <Visibility public={track.public} />
                  )}
                </Table.Cell>

                <Table.Cell textAlign="right">
                  {formatDistance(track.length)}
                </Table.Cell>

                <Table.Cell textAlign="right">
                  {formatDuration(track.duration)}
                </Table.Cell>

                <Table.Cell>
                  {track.userDeviceId
                    ? deviceNames?.[track.userDeviceId] ?? "..."
                    : null}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </>
  );
}

function UploadButton({ navigate, ...props }) {
  const { t } = useTranslation();
  const onClick = useCallback(
    (e) => {
      e.preventDefault();
      navigate();
    },
    [navigate]
  );
  return (
    <Button onClick={onClick} {...props} color="green">
      {t("TracksPage.upload")}
    </Button>
  );
}

const MyTracksPage = connect((state) => ({ login: (state as any).login }))(
  function MyTracksPage({ login }) {
    const { t } = useTranslation();

    const title = t("TracksPage.titleUser");

    return (
      <Page title={title}>
        <TracksTable {...{ title }} />
      </Page>
    );
  }
);

export default MyTracksPage;
