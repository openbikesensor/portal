import React from "react";
import _ from "lodash";
import { connect } from "react-redux";
import {
  List,
  Select,
  Input,
  Divider,
  Label,
  Checkbox,
  Header,
} from "semantic-ui-react";
import { useTranslation } from "react-i18next";

import {
  MapConfig,
  setMapConfigFlag as setMapConfigFlagAction,
  initialState as defaultMapConfig,
} from "reducers/mapConfig";
import { colorByDistance, colorByCount, viridisSimpleHtml } from "mapstyles";
import { ColorMapLegend, DiscreteColorMapLegend } from "components";

const BASEMAP_STYLE_OPTIONS = ["positron", "bright"];

const ROAD_ATTRIBUTE_OPTIONS = [
  "distance_overtaker_mean",
  "distance_overtaker_min",
  "distance_overtaker_max",
  "distance_overtaker_median",
  "overtaking_event_count",
  "usage_count",
  "zone",
];

const DATE_FILTER_MODES = [
  { value: "none", key: "none", text: "All time" },
  { value: "range", key: "range", text: "Start and end range" },
  { value: "threshold", key: "threshold", text: "Before/after comparison" },
];

type User = Object;

function LayerSidebar({
  mapConfig,
  login,
  setMapConfigFlag,
}: {
  login: User | null;
  mapConfig: MapConfig;
  setMapConfigFlag: (flag: string, value: unknown) => void;
}) {
  const { t } = useTranslation();
  const {
    baseMap: { style },
    obsRoads: { show: showRoads, showUntagged, attribute, maxCount },
    obsEvents: { show: showEvents },
    filters: {
      currentUser: filtersCurrentUser,
      dateMode,
      startDate,
      endDate,
      thresholdAfter,
    },
  } = mapConfig;

  return (
    <div>
      <List relaxed>
        <List.Item>
          <List.Header>{t("MapPage.sidebar.baseMap.style.label")}</List.Header>
          <Select
            options={BASEMAP_STYLE_OPTIONS.map((value) => ({
              value,
              key: value,
              text: t(`MapPage.sidebar.baseMap.style.${value}`),
            }))}
            value={style}
            onChange={(_e, { value }) =>
              setMapConfigFlag("baseMap.style", value)
            }
          />
        </List.Item>
        <Divider />
        <List.Item>
          <Checkbox
            toggle
            size="small"
            id="obsRoads.show"
            style={{ float: "right" }}
            checked={showRoads}
            onChange={() => setMapConfigFlag("obsRoads.show", !showRoads)}
          />
          <label htmlFor="obsRoads.show">
            <Header as="h4">{t("MapPage.sidebar.obsRoads.title")}</Header>
          </label>
        </List.Item>
        {showRoads && (
          <>
            <List.Item>
              <Checkbox
                checked={showUntagged}
                onChange={() =>
                  setMapConfigFlag("obsRoads.showUntagged", !showUntagged)
                }
                label={t("MapPage.sidebar.obsRoads.showUntagged.label")}
              />
            </List.Item>
            <List.Item>
              <List.Header>
                {t("MapPage.sidebar.obsRoads.attribute.label")}
              </List.Header>
              <Select
                fluid
                options={ROAD_ATTRIBUTE_OPTIONS.map((value) => ({
                  value,
                  key: value,
                  text: t(`MapPage.sidebar.obsRoads.attribute.${value}`),
                }))}
                value={attribute}
                onChange={(_e, { value }) =>
                  setMapConfigFlag("obsRoads.attribute", value)
                }
              />
            </List.Item>
            {attribute.endsWith("_count") ? (
              <>
                <List.Item>
                  <List.Header>
                    {t("MapPage.sidebar.obsRoads.maxCount.label")}
                  </List.Header>
                  <Input
                    fluid
                    type="number"
                    value={maxCount}
                    onChange={(_e, { value }) =>
                      setMapConfigFlag("obsRoads.maxCount", value)
                    }
                  />
                </List.Item>
                <List.Item>
                  <ColorMapLegend
                    map={_.chunk(
                      colorByCount(
                        "obsRoads.maxCount",
                        mapConfig.obsRoads.maxCount,
                        viridisSimpleHtml
                      ).slice(3),
                      2
                    )}
                    twoTicks
                  />
                </List.Item>
              </>
            ) : attribute.endsWith("zone") ? (
              <>
                <List.Item>
                  <Label
                    size="small"
                    style={{ background: "blue", color: "white" }}
                  >
                    {t("general.zone.urban")} (1.5&nbsp;m)
                  </Label>
                  <Label
                    size="small"
                    style={{ background: "cyan", color: "black" }}
                  >
                    {t("general.zone.rural")}(2&nbsp;m)
                  </Label>
                </List.Item>
              </>
            ) : (
              <>
                <List.Item>
                  <List.Header>
                    {_.upperFirst(t("general.zone.urban"))}
                  </List.Header>
                  <DiscreteColorMapLegend
                    map={colorByDistance("distance_overtaker")[3][5].slice(2)}
                  />
                </List.Item>
                <List.Item>
                  <List.Header>
                    {_.upperFirst(t("general.zone.rural"))}
                  </List.Header>
                  <DiscreteColorMapLegend
                    map={colorByDistance("distance_overtaker")[3][3].slice(2)}
                  />
                </List.Item>
              </>
            )}
          </>
        )}
        <Divider />
        <List.Item>
          <Checkbox
            toggle
            size="small"
            id="obsEvents.show"
            style={{ float: "right" }}
            checked={showEvents}
            onChange={() => setMapConfigFlag("obsEvents.show", !showEvents)}
          />
          <label htmlFor="obsEvents.show">
            <Header as="h4">{t("MapPage.sidebar.obsEvents.title")}</Header>
          </label>
        </List.Item>
        {showEvents && (
          <>
            <List.Item>
              <List.Header>{_.upperFirst(t("general.zone.urban"))}</List.Header>
              <DiscreteColorMapLegend
                map={colorByDistance("distance_overtaker")[3][5].slice(2)}
              />
            </List.Item>
            <List.Item>
              <List.Header>{_.upperFirst(t("general.zone.rural"))}</List.Header>
              <DiscreteColorMapLegend
                map={colorByDistance("distance_overtaker")[3][3].slice(2)}
              />
            </List.Item>
          </>
        )}
        <Divider />

        <List.Item>
          <Header as="h4">Filters</Header>
        </List.Item>

        {login && (
          <>
            <List.Item>
              <Header as="h5">User data</Header>
            </List.Item>

            <List.Item>
              <Checkbox
                toggle
                size="small"
                id="filters.currentUser"
                checked={filtersCurrentUser}
                onChange={() =>
                  setMapConfigFlag("filters.currentUser", !filtersCurrentUser)
                }
                label="Show only my own data"
              />
            </List.Item>

            <List.Item>
              <Header as="h5">Date range</Header>
            </List.Item>

            <List.Item>
              <Select
                id="filters.dateMode"
                options={DATE_FILTER_MODES}
                value={dateMode ?? "none"}
                onChange={(_e, { value }) =>
                  setMapConfigFlag("filters.dateMode", value)
                }
              />
            </List.Item>

            {dateMode == "range" && (
              <List.Item>
                <Input
                  type="date"
                  min="2000-01-03"
                  step="7"
                  size="small"
                  id="filters.startDate"
                  onChange={(_e, { value }) =>
                    setMapConfigFlag("filters.startDate", value)
                  }
                  value={startDate ?? null}
                  label="Start"
                />
              </List.Item>
            )}

            {dateMode == "range" && (
              <List.Item>
                <Input
                  type="date"
                  min="2000-01-03"
                  step="7"
                  size="small"
                  id="filters.endDate"
                  onChange={(_e, { value }) =>
                    setMapConfigFlag("filters.endDate", value)
                  }
                  value={endDate ?? null}
                  label="End"
                />
              </List.Item>
            )}

            {dateMode == "threshold" && (
              <List.Item>
                <Input
                  type="date"
                  min="2000-01-03"
                  step="7"
                  size="small"
                  id="filters.startDate"
                  value={startDate ?? null}
                  onChange={(_e, { value }) =>
                    setMapConfigFlag("filters.startDate", value)
                  }
                  label="Threshold"
                />
              </List.Item>
            )}

            {dateMode == "threshold" && (
              <List.Item>
                <span>
                  Before{" "}
                  <Checkbox
                    toggle
                    size="small"
                    checked={thresholdAfter ?? false}
                    onChange={() =>
                      setMapConfigFlag(
                        "filters.thresholdAfter",
                        !thresholdAfter
                      )
                    }
                    id="filters.thresholdAfter"
                  />{" "}
                  After
                </span>
              </List.Item>
            )}
          </>
        )}
        {!login && <List.Item>No filters available without login.</List.Item>}
      </List>
    </div>
  );
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
  { setMapConfigFlag: setMapConfigFlagAction }
  //
)(LayerSidebar);
