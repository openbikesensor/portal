import React, { useState, useCallback, useMemo, useRef } from "react";
import _ from "lodash";
import { connect } from "react-redux";
import { Button } from "semantic-ui-react";
import { Layer, Source } from "react-map-gl";
import produce from "immer";
import classNames from "classnames";

import api from "api";
import type { Location } from "types";
import { Page, Map } from "components";
import { useConfig } from "config";
import {
  colorByDistance,
  colorByCount,
  getRegionLayers,
  borderByZone,
  isValidAttribute,
} from "mapstyles";
import { useMapConfig } from "reducers/mapConfig";

import RoadInfo, { RoadInfoType } from "./RoadInfo";
import RegionInfo from "./RegionInfo";
import LayerSidebar from "./LayerSidebar";
import styles from "./styles.module.less";

const untaggedRoadsLayer = {
  id: "obs_roads_untagged",
  type: "line",
  source: "obs",
  "source-layer": "obs_roads",
  minzoom: 12,
  filter: ["!", ["to-boolean", ["get", "distance_overtaker_mean"]]],
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 2, 17, 2],
    "line-color": "#ABC",
    // "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
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
};

const getUntaggedRoadsLayer = (colorAttribute) =>
  produce(untaggedRoadsLayer, (draft) => {
    draft.filter = ["!", isValidAttribute(colorAttribute)];
  });

const getRoadsLayer = (colorAttribute, maxCount) =>
  produce(untaggedRoadsLayer, (draft) => {
    draft.id = "obs_roads_normal";
    draft.filter = isValidAttribute(colorAttribute);
    draft.minzoom = 10;
    draft.paint["line-width"][6] = 6; // scale bigger on zoom
    draft.paint["line-color"] = colorAttribute.startsWith("distance_")
      ? colorByDistance(colorAttribute)
      : colorAttribute.endsWith("_count")
      ? colorByCount(colorAttribute, maxCount)
      : colorAttribute.endsWith("zone")
      ? borderByZone()
      : "#DDD";
    // draft.paint["line-opacity"][3] = 12;
    // draft.paint["line-opacity"][5] = 13;
  });

const getEventsLayer = () => ({
  id: "obs_events",
  type: "circle",
  source: "obs",
  "source-layer": "obs_events",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 17, 8],
    "circle-opacity": ["interpolate",["linear"],["zoom"],8,0.1,9,0.3,10,0.5,11,1],
    "circle-color": colorByDistance("distance_overtaker"),
  },
  minzoom: 8,
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

interface RegionInfo {
  properties: {
    admin_level: number;
    name: string;
    overtaking_event_count: number;
  };
}

type Details =
  | { type: "road"; road: RoadInfoType }
  | { type: "region"; region: RegionInfo };

function MapPage({ login }) {
  const { obsMapSource, banner } = useConfig() || {};
  const [details, setDetails] = useState<null | Details>(null);

  const onCloseDetails = useCallback(() => setDetails(null), [setDetails]);

  const mapConfig = useMapConfig();

  const viewportRef = useRef();
  const mapInfoPortal = useRef();

  const onViewportChange = useCallback(
    (viewport) => {
      viewportRef.current = viewport;
    },
    [viewportRef]
  );

  const onClick = useCallback(
    async (e) => {
      // check if we clicked inside the mapInfoBox, if so, early exit
      let node = e.target;
      while (node) {
        if (
          [styles.mapInfoBox, styles.mapToolbar].some((className) =>
            node?.classList?.contains(className)
          )
        ) {
          return;
        }
        node = node.parentNode;
      }

      const { zoom } = viewportRef.current;

      if (zoom < 10) {
        const clickedRegion = e.features?.find(
          (f) => f.source === "obs" && f.sourceLayer === "obs_regions"
        );
        setDetails(
          clickedRegion ? { type: "region", region: clickedRegion } : null
        );
      } else {
        const road = await api.get("/mapdetails/road", {
          query: {
            longitude: e.lngLat[0],
            latitude: e.lngLat[1],
            radius: 100,
          },
        });
        setDetails(road?.road ? { type: "road", road } : null);
      }
    },
    [setDetails]
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

  const regionLayers = useMemo(() => getRegionLayers(), []);
  if (mapConfig.obsRegions.show) {
    layers.push(...regionLayers);
  }

  const eventsLayer = useMemo(() => getEventsLayer(), []);
  const eventsTextLayer = useMemo(() => getEventsTextLayer(), []);

  if (mapConfig.obsEvents.show) {
    layers.push(eventsLayer);
    layers.push(eventsTextLayer);
  }

  const onToggleLayerSidebarButtonClick = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log("toggl;e");
      setLayerSidebar((v) => !v);
    },
    [setLayerSidebar]
  );

  if (!obsMapSource) {
    return null;
  }

  const tiles = obsMapSource?.tiles?.map((tileUrl: string) => {
    const query = new URLSearchParams();
    if (login) {
      if (mapConfig.filters.currentUser) {
        query.append("user", login.id);
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
        ref={mapInfoPortal}
      >
        {layerSidebar && (
          <div className={styles.mapSidebar}>
            <LayerSidebar />
          </div>
        )}
        <div className={styles.map}>
          <Map
            viewportFromUrl
            onClick={onClick}
            hasToolbar
            onViewportChange={onViewportChange}
          >
            <div className={styles.mapToolbar}>
              <Button
                primary
                icon="bars"
                active={layerSidebar}
                onClick={onToggleLayerSidebarButtonClick}
              />
            </div>
            <Source id="obs" {...obsMapSource} tiles={tiles}>
              {layers.map((layer) => (
                <Layer key={layer.id} {...layer} />
              ))}
            </Source>

            {details?.type === "road" && details?.road?.road && (
              <RoadInfo
                roadInfo={details.road}
                mapInfoPortal={mapInfoPortal.current}
                onClose={onCloseDetails}
                {...{ hasFilters }}
              />
            )}

            {details?.type === "region" && details?.region && (
              <RegionInfo
                region={details.region}
                mapInfoPortal={mapInfoPortal.current}
                onClose={onCloseDetails}
              />
            )}
          </Map>
        </div>
      </div>
    </Page>
  );
}

export default connect((state) => ({ login: state.login }))(MapPage);
