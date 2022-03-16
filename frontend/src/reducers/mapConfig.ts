import { useMemo } from "react";
import { useSelector } from "react-redux";
import produce from "immer";
import _ from "lodash";

type BaseMapStyle = "positron" | "bright";

type RoadAttribute =
  | "distance_overtaker_mean"
  | "distance_overtaker_min"
  | "distance_overtaker_max"
  | "distance_overtaker_median"
  | "overtaking_event_count"
  | "usage_count";

export type MapConfig = {
  baseMap: {
    style: BaseMapStyle;
  };
  obsRoads: {
    show: boolean;
    showUntagged: boolean;
    attribute: RoadAttribute;
    maxCount: number;
  };
  obsEvents: {
    show: boolean;
  };
};

export const initialState: MapConfig = {
  baseMap: {
    style: "positron",
  },
  obsRoads: {
    show: true,
    showUntagged: true,
    attribute: "distance_overtaker_median",
    maxCount: 20,
  },
  obsEvents: {
    show: false,
  },
};

type MapConfigAction = {
  type: "MAP_CONFIG.SET_FLAG";
  payload: { flag: string; value: any };
};

export function setMapConfigFlag(
  flag: string,
  value: unknown
): MapConfigAction {
  return { type: "MAP_CONFIG.SET_FLAG", payload: { flag, value } };
}

export function useMapConfig() {
  const mapConfig = useSelector((state) => state.mapConfig);
  const result = useMemo(
    () => _.merge({}, initialState, mapConfig),
    [mapConfig]
  );
  return result;
}

export default function mapConfigReducer(
  state: MapConfig = initialState,
  action: MapConfigAction
) {
  switch (action.type) {
    case "MAP_CONFIG.SET_FLAG":
      return produce(state, (draft) => {
        _.set(draft, action.payload.flag, action.payload.value);
      });

    default:
      return state;
  }
}
