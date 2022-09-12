import React, { useState, useCallback, useMemo } from "react";
import _ from "lodash";
import { connect } from "react-redux";
import { Button } from "semantic-ui-react";
import { Layer, Source } from "react-map-gl";
import produce from "immer";
import classNames from "classnames";

import type { Location } from "types";
import { Page, Map } from "components";
import { useConfig } from "config";
import {
  colorByDistance,
  colorByCount,
  borderByZone,
  reds,
  isValidAttribute,
} from "mapstyles";
import { useMapConfig } from "reducers/mapConfig";

import RoadInfo from "./RoadInfo";
import LayerSidebar from "./LayerSidebar";
import styles from "./styles.module.less";

const untaggedRoadsLayer = {
  id: "obs_roads_untagged",
  type: "line",
  source: "obs",
  "source-layer": "obs_roads",
  filter: ["!", ["to-boolean", ["get", "distance_overtaker_mean"]]],
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 2, 17, 2],
    "line-color": "#ABC",
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
    "line-offset": [
      "interpolate",
      ["exponential", 1.5],
      ["zoom"],
      12,
      ["get", "offset_direction"],
      19,
      ["*", ["get", "offset_direction"], 8],
    ],
  },
  minzoom: 12,
};

const getUntaggedRoadsLayer = (colorAttribute, maxCount) =>
  produce(untaggedRoadsLayer, (draft) => {
    draft.filter = ["!", isValidAttribute(colorAttribute)];
  });

const getRoadsLayer = (colorAttribute, maxCount) =>
  produce(untaggedRoadsLayer, (draft) => {
    draft.id = "obs_roads_normal";
    draft.filter = isValidAttribute(colorAttribute);
    draft.paint["line-width"][6] = 6; // scale bigger on zoom
    draft.paint["line-color"] = colorAttribute.startsWith("distance_")
      ? colorByDistance(colorAttribute)
      : colorAttribute.endsWith("_count")
      ? colorByCount(colorAttribute, maxCount)
      : colorAttribute.endsWith("zone")
      ? borderByZone()
      : "#DDD";
    draft.paint["line-opacity"][3] = 12;
    draft.paint["line-opacity"][5] = 13;
  });

const getEventsLayer = () => ({
  id: "obs_events",
  type: "circle",
  source: "obs",
  "source-layer": "obs_events",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 17, 8],
    "circle-color": colorByDistance("distance_overtaker"),
  },
  minzoom: 11,
});

const getEventsTextLayer = () => ({
  id: "obs_events_text",
  type: "symbol",
  minzoom: 18,
  source: "obs",
  "source-layer": "obs_events",
  layout: {
    "text-field": [
      "number-format",
      ["get", "distance_overtaker"],
      { "min-fraction-digits": 2, "max-fraction-digits": 2 },
    ],
    "text-allow-overlap": true,
    "text-font": ["Open Sans Bold", "Arial Unicode MS Regular"],
    "text-size": 14,
    "text-keep-upright": false,
    "text-anchor": "left",
    "text-radial-offset": 1,
    "text-rotate": ["-", 90, ["*", ["get", "course"], 180 / Math.PI]],
    "text-rotation-alignment": "map",
  },
  paint: {
    "text-halo-color": "rgba(255, 255, 255, 1)",
    "text-halo-width": 1,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.3, 1],
  },
});

function MapPage({ login }) {
  const { obsMapSource, banner } = useConfig() || {};
  const [clickLocation, setClickLocation] = useState<Location | null>(null);

  const mapConfig = useMapConfig();

  const onClick = useCallback(
    (e) => {
      let node = e.target;
      while (node) {
        if (node?.classList?.contains(styles.mapInfoBox)) {
          return;
        }
        node = node.parentNode;
      }

      setClickLocation({ longitude: e.lngLat[0], latitude: e.lngLat[1] });
    },
    [setClickLocation]
  );

  const [layerSidebar, setLayerSidebar] = useState(true);

  const {
    obsRoads: { attribute, maxCount },
  } = mapConfig;

  const layers = [];

  const untaggedRoadsLayerCustom = useMemo(
    () => getUntaggedRoadsLayer(attribute),
    [attribute]
  );
  if (mapConfig.obsRoads.show && mapConfig.obsRoads.showUntagged) {
    layers.push(untaggedRoadsLayerCustom);
  }

  const roadsLayer = useMemo(
    () => getRoadsLayer(attribute, maxCount),
    [attribute, maxCount]
  );
  if (mapConfig.obsRoads.show) {
    layers.push(roadsLayer);
  }

  const eventsLayer = useMemo(() => getEventsLayer(), []);
  const eventsTextLayer = useMemo(() => getEventsTextLayer(), []);
  if (mapConfig.obsEvents.show) {
    layers.push(eventsLayer);
    layers.push(eventsTextLayer);
  }

  if (!obsMapSource) {
    return null;
  }

  const tiles = obsMapSource?.tiles?.map((tileUrl: string) => {
    const query = new URLSearchParams();
    if (login) {
      if (mapConfig.filters.currentUser) {
        query.append("user", login.username);
      }

      if (mapConfig.filters.dateMode === "range") {
        if (mapConfig.filters.startDate) {
          query.append("start", mapConfig.filters.startDate);
        }
        if (mapConfig.filters.endDate) {
          query.append("end", mapConfig.filters.endDate);
        }
      } else if (mapConfig.filters.dateMode === "threshold") {
        if (mapConfig.filters.startDate) {
          query.append(
            mapConfig.filters.thresholdAfter ? "start" : "end",
            mapConfig.filters.startDate
          );
        }
      }
    }
    const queryString = String(query);
    return tileUrl + (queryString ? "?" : "") + queryString;
  });

  const hasFilters: boolean =
    login &&
    (mapConfig.filters.currentUser || mapConfig.filters.dateMode !== "none");

  return (
    <Page fullScreen title="Map">
      <div
        className={classNames(
          styles.mapContainer,
          banner ? styles.hasBanner : null
        )}
      >
        {layerSidebar && (
          <div className={styles.mapSidebar}>
            <LayerSidebar />
          </div>
        )}
        <div className={styles.map}>
          <Map viewportFromUrl onClick={onClick} hasToolbar>
            <Button
              style={{
                position: "absolute",
                left: 16,
                top: 16,
              }}
              primary
              icon="bars"
              active={layerSidebar}
              onClick={() => setLayerSidebar(layerSidebar ? false : true)}
            />
            <Source id="obs" {...obsMapSource} tiles={tiles}>
              {layers.map((layer) => (
                <Layer key={layer.id} {...layer} />
              ))}
            </Source>

            <RoadInfo {...{ clickLocation, hasFilters }} />
          </Map>
        </div>
      </div>
    </Page>
  );
}

export default connect((state) => ({ login: state.login }))(MapPage);
