import React, { useState, useCallback, useMemo } from "react";
import { Source, Layer } from "react-map-gl";
import _ from "lodash";
import { Button, Form, Dropdown, Header, Message, Icon } from "semantic-ui-react";

import { useConfig } from "config";
import { Page, Map } from "components";

const BoundingBoxSelector = React.forwardRef(
  ({ value, name, onChange }, ref) => {
    const [pointNum, setPointNum] = useState(0);
    const [point0, setPoint0] = useState(null);
    const [point1, setPoint1] = useState(null);

    const onClick = (e) => {
      if (pointNum == 0) {
        setPoint0(e.lngLat);
      } else {
        setPoint1(e.lngLat);
      }
      setPointNum(1 - pointNum);
    };

    React.useEffect(() => {
      if (!point0 || !point1) return;
      const bbox = `${point0[0]},${point0[1]},${point1[0]},${point1[1]}`;
      if (bbox !== value) {
        onChange(bbox);
      }
    }, [point0, point1]);

    React.useEffect(() => {
      const [p00, p01, p10, p11] = value
        .split(",")
        .map((v) => Number.parseFloat(v));
      if (!point0 || point0[0] != p00 || point0[1] != p01)
        setPoint0([p00, p01]);
      if (!point1 || point1[0] != p10 || point1[1] != p11)
        setPoint1([p10, p11]);
    }, [value]);

    return (
      <div>
        <Form.Input label="Bounding box" {...{ name, value, onChange }} />

        <div style={{ height: 400, position: "relative", marginBottom: 16 }}>
          <Map onClick={onClick}>
            <Source
              id="bbox"
              type="geojson"
              data={
                point0 && point1
                  ? {
                      type: "FeatureCollection",
                      features: [
                        {
                          type: "Feature",
                          geometry: {
                            type: "Polygon",
                            coordinates: [
                              [
                                [point0[0], point0[1]],
                                [point1[0], point0[1]],
                                [point1[0], point1[1]],
                                [point0[0], point1[1]],
                                [point0[0], point0[1]],
                              ],
                            ],
                          },
                        },
                      ],
                    }
                  : {}
              }
            >
              <Layer
                id="bbox"
                type="line"
                paint={{
                  "line-width": 4,
                  "line-color": "#F06292",
                }}
              />
            </Source>
          </Map>
        </div>
      </div>
    );
  }
);

const MODES = [
  {
    key: "events",
    text: "Events",
    value: "events",
  },
];

const FORMATS = [
  {
    key: "geojson",
    text: "GeoJSON",
    value: "geojson",
  },
  {
    key: "shapefile",
    text: "Shapefile (ZIP)",
    value: "shapefile",
  },
];

export default function ExportPage() {
  const [mode, setMode] = useState("events");
  const [bbox, setBbox] = useState("8.294678,49.651182,9.059601,50.108249");
  const [fmt, setFmt] = useState("geojson");
  const config = useConfig();
  const exportUrl = `${config?.apiUrl}/export/events?bbox=${bbox}&fmt=${fmt}`;
  return (
    <Page title="Export">
      <Header as="h2">Export</Header>

        <Message icon info>
          <Icon name="info circle" />
          <Message.Content>
            <p>
              This page allows you to export parts of the public dataset under
              the license for data announced in the privacy statement of this
              site.
            </p>

            <p>
              Please consider this export <b>experimental</b> and expect the data
              shape to change in the future. Automated usage of this export
              functionality is discouraged for now. Try not to use too much computing
              capacity when exporting data, so select the bounding box as small as
              possible and do not exceed unreasonable poll frequencies.
            </p>
          </Message.Content>
        </Message>

      <Form>
        <Form.Field>
          <label>Mode</label>
          <Dropdown
            placeholder="Select mode"
            fluid
            selection
            options={MODES}
            value={mode}
            onChange={(_e, { value }) => setMode(value)}
          />
        </Form.Field>

        <Form.Field>
          <label>Format</label>
          <Dropdown
            placeholder="Select format"
            fluid
            selection
            options={FORMATS}
            value={fmt}
            onChange={(_e, { value }) => setFmt(value)}
          />
        </Form.Field>

        <BoundingBoxSelector value={bbox} onChange={setBbox} />

        <Button
          primary
          as="a"
          href={exportUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Export
        </Button>
      </Form>
    </Page>
  );
}
