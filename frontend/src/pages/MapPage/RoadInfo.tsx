import React, {useState, useCallback} from 'react'
import _ from 'lodash'
import {Segment, Menu, Header, Label, Icon, Table, Message, Button} from 'semantic-ui-react'
import {Layer, Source} from 'react-map-gl'
import {of, from, concat} from 'rxjs'
import {useObservable} from 'rxjs-hooks'
import {switchMap, distinctUntilChanged} from 'rxjs/operators'
import {Chart} from 'components'
import {pairwise} from 'utils'

import type { Location } from "types";
import api from "api";
import { colorByDistance, borderByZone } from "mapstyles";

import styles from "./styles.module.less";

function selectFromColorMap(colormap, value) {
  let last = null;
  for (let i = 0; i < colormap.length; i += 2) {
    if (colormap[i + 1] > value) {
      return colormap[i];
    }
  }
  return colormap[colormap.length - 1];
}

const UNITS = {
  distanceOvertaker: "m",
  distanceStationary: "m",
  speed: "km/h",
};
const ZONE_COLORS = { urban: "blue", rural: "cyan", motorway: "purple" };
const CARDINAL_DIRECTIONS = [
  "north",
  "northEast",
  "east",
  "southEast",
  "south",
  "southWest",
  "west",
  "northWest",
];
const getCardinalDirection = (t, bearing) => {
  if (bearing == null) {
    return t("MapPage.roadInfo.cardinalDirections.unknown");
  } else {
    const n = CARDINAL_DIRECTIONS.length;
    const i = Math.floor(((bearing / 360.0) * n + 0.5) % n);
    const name = CARDINAL_DIRECTIONS[i];
    return t(`MapPage.roadInfo.cardinalDirections.${name}`);
  }
};

function RoadStatsTable({ data }) {
  const { t } = useTranslation();
  return (
    <Table size="small" compact>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell textAlign="right"></Table.HeaderCell>
          {["distanceOvertaker", "distanceStationary", "speed"].map((prop) => (
            <Table.HeaderCell key={prop} textAlign="right">
              {t(`MapPage.roadInfo.${prop}`)}
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {["count", "min", "median", "max", "mean"].map((stat) => (
          <Table.Row key={stat}>
            <Table.Cell> {t(`MapPage.roadInfo.${stat}`)}</Table.Cell>
            {["distanceOvertaker", "distanceStationary", "speed"].map(
              (prop) => (
                <Table.Cell key={prop} textAlign="right">
                  {(
                    data[prop]?.statistics?.[stat] *
                    (prop === `speed` && stat != "count" ? 3.6 : 1)
                  ).toFixed(stat === "count" ? 0 : 2)}
                  {stat !== "count" && ` ${UNITS[prop]}`}
                </Table.Cell>
              )
            )}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function HistogramChart({ bins, counts, zone }) {
  const diff = bins[1] - bins[0];
  const colortype = zone === "rural" ? 3 : 5;
  const data = _.zip(
    bins.slice(0, bins.length - 1).map((v) => v + diff / 2),
    counts
  ).map((value) => ({
    value,
    itemStyle: {
      color: selectFromColorMap(
        colorByDistance()[3][colortype].slice(2),
        value[0]
      ),
    },
  }));

  return (
    <Chart
      style={{ height: 240 }}
      option={{
        grid: { top: 30, bottom: 30, right: 30, left: 30 },
        xAxis: {
          type: "value",
          axisLabel: { formatter: (v) => `${Math.round(v * 100)} cm` },
          min: 0,
          max: 2.5,
        },
        yAxis: {},
        series: [
          {
            type: "bar",
            data,

            barMaxWidth: 20,
          },
        ],
      }}
    />
  );
}

export default function RoadInfo({
  clickLocation,
  hasFilters,
  onClose,
}: {
  clickLocation: Location | null;
  hasFilters: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [direction, setDirection] = useState("forwards");

  const onClickDirection = useCallback(
    (e, { name }) => {
      e.preventDefault();
      e.stopPropagation();
      setDirection(name);
    },
    [setDirection]
  );

  const info = useObservable(
    (_$, inputs$) =>
      inputs$.pipe(
        distinctUntilChanged(_.isEqual),
        switchMap(([location]) =>
          location
            ? concat(
                of(null),
                from(
                  api.get("/mapdetails/road", {
                    query: {
                      ...location,
                      radius: 100,
                    },
                  })
                )
              )
            : of(null)
        )
      ),
    null,
    [clickLocation]
  );

  if (!clickLocation) {
    return null;
  }

  const loading = info == null;

  const offsetDirection = info?.road?.oneway
    ? 0
    : direction === "forwards"
    ? 1
    : -1; // TODO: change based on left-hand/right-hand traffic

  const content =
    !loading && !info.road ? (
      "No road found."
    ) : (
      <>
        <Header as="h3">
          {loading
            ? "..."
            : info?.road.name || t("MapPage.roadInfo.unnamedWay")}

          <Button
            style={{ float: "right" }}
            onClick={onClose}
            title={t("MapPage.roadInfo.closeTooltip")}
            size="small"
            icon="close"
            basic
          />
        </Header>

        {hasFilters && (
          <Message info icon>
            <Icon name="info circle" small />
            <Message.Content>
              {t("MapPage.roadInfo.hintFiltersNotApplied")}
            </Message.Content>
          </Message>
        )}

        {info.road.zone && (
          <Label size="small" color={ZONE_COLORS[info.road.zone]}>
            {t(`general.zone.${info.road.zone}`)}
          </Label>
        )}

        {info.road.oneway && (
          <Label size="small" color="blue">
            <Icon name="long arrow alternate right" fitted />{" "}
            {t("MapPage.roadInfo.oneway")}
          </Label>
        )}

        {info.road.oneway ? null : (
          <Menu size="tiny" pointing>
            <Menu.Item header>{t("MapPage.roadInfo.direction")}</Menu.Item>
            <Menu.Item
              name="forwards"
              active={direction === "forwards"}
              onClick={onClickDirection}
            >
              {getCardinalDirection(t, info.forwards?.bearing)}
            </Menu.Item>
            <Menu.Item
              name="backwards"
              active={direction === "backwards"}
              onClick={onClickDirection}
            >
              {getCardinalDirection(t, info.backwards?.bearing)}
            </Menu.Item>
          </Menu>
        )}

        {info[direction] && <RoadStatsTable data={info[direction]} />}

        {info[direction]?.distanceOvertaker?.histogram && (
          <>
            <Header as="h5">
              {t("MapPage.roadInfo.overtakerDistanceDistribution")}
            </Header>
            <HistogramChart
              {...info[direction]?.distanceOvertaker?.histogram}
            />
          </>
        )}
      </>
    );

  return (
    <>
      {info.road && (
        <Source id="highlight" type="geojson" data={info.road.geometry}>
          <Layer
            id="route"
            type="line"
            paint={{
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14,
                6,
                17,
                12,
              ],
              "line-color": "#18FFFF",
              "line-opacity": 0.5,
              ...{
                "line-offset": [
                  "interpolate",
                  ["exponential", 1.5],
                  ["zoom"],
                  12,
                  offsetDirection,
                  19,
                  offsetDirection * 8,
                ],
              },
            }}
          />
        </Source>
      )}

      {content && mapInfoPortal && (
        createPortal(
        <div className={styles.mapInfoBox}>
          {content}
        </div>, mapInfoPortal))}
      )}
    </>
  );
}
