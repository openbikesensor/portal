import React from "react";
import { connect } from "react-redux";
import {
  List,
  Dropdown,
  Checkbox,
  Segment,
  Dimmer,
  Grid,
  Loader,
  Header,
  Message,
  Confirm,
  Container,
} from "semantic-ui-react";
import { useParams, useHistory } from "react-router-dom";
import { concat, combineLatest, of, from, Subject } from "rxjs";
import {
  pluck,
  distinctUntilChanged,
  map,
  switchMap,
  startWith,
  catchError,
} from "rxjs/operators";
import { useObservable } from "rxjs-hooks";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";

import api from "api";
import { Page } from "components";
import type { Track, TrackData, TrackComment } from "types";
import { trackLayer, trackLayerRaw } from "../../mapstyles";

import TrackActions from "./TrackActions";
import TrackComments from "./TrackComments";
import TrackDetails from "./TrackDetails";
import TrackMap from "./TrackMap";

import styles from "./TrackPage.module.less";

function useTriggerSubject() {
  const subject$ = React.useMemo(() => new Subject(), []);
  const trigger = React.useCallback(() => subject$.next(null), [subject$]);
  return [trigger, subject$];
}

function TrackMapSettings({
  showTrack,
  setShowTrack,
  pointsMode,
  setPointsMode,
  side,
  setSide,
}) {
  const { t } = useTranslation();
  return (
    <>
      <Header as="h4">{t("TrackPage.mapSettings.title")}</Header>
      <List>
        <List.Item>
          <Checkbox
            checked={showTrack}
            onChange={(e, d) => setShowTrack(d.checked)}
          />{" "}
          {t("TrackPage.mapSettings.showTrack")}
          <div style={{ marginTop: 8 }}>
            <span
              style={{
                borderTop: "3px dashed " + trackLayerRaw.paint["line-color"],
                height: 0,
                width: 24,
                display: "inline-block",
                verticalAlign: "middle",
                marginRight: 4,
              }}
            />
            {t("TrackPage.mapSettings.gpsTrack")}
          </div>
          <div>
            <span
              style={{
                borderTop: "6px solid " + trackLayerRaw.paint["line-color"],
                height: 6,
                width: 24,
                display: "inline-block",
                verticalAlign: "middle",
                marginRight: 4,
              }}
            />
            {t("TrackPage.mapSettings.snappedTrack")}
          </div>
        </List.Item>
        <List.Item>
          <List.Header> {t("TrackPage.mapSettings.points")} </List.Header>
          <Dropdown
            selection
            value={pointsMode}
            onChange={(e, d) => setPointsMode(d.value)}
            options={[
              { key: "none", value: "none", text: "None" },
              {
                key: "overtakingEvents",
                value: "overtakingEvents",
                text: t("TrackPage.mapSettings.confirmedPoints"),
              },
              {
                key: "measurements",
                value: "measurements",
                text: t("TrackPage.mapSettings.allPoints"),
              },
            ]}
          />
        </List.Item>
        <List.Item>
          <List.Header>{t("TrackPage.mapSettings.side")}</List.Header>
          <Dropdown
            selection
            value={side}
            onChange={(e, d) => setSide(d.value)}
            options={[
              {
                key: "overtaker",
                value: "overtaker",
                text: t("TrackPage.mapSettings.overtakerSide"),
              },
              {
                key: "stationary",
                value: "stationary",
                text: t("TrackPage.mapSettings.stationarySide"),
              },
            ]}
          />
        </List.Item>
      </List>
    </>
  );
}

const TrackPage = connect((state) => ({ login: state.login }))(
  function TrackPage({ login }) {
    const { slug } = useParams();
    const { t } = useTranslation();

    const [reloadComments, reloadComments$] = useTriggerSubject();
    const history = useHistory();

    const data: {
      track: null | Track;
      trackData: null | TrackData;
      comments: null | TrackComment[];
    } | null = useObservable(
      (_$, args$) => {
        const slug$ = args$.pipe(pluck(0), distinctUntilChanged());
        const track$ = slug$.pipe(
          map((slug) => `/tracks/${slug}`),
          switchMap((url) =>
            concat(
              of(null),
              from(api.get(url)).pipe(
                catchError(() => {
                  history.replace("/tracks");
                })
              )
            )
          ),
          pluck("track")
        );

        const trackData$ = slug$.pipe(
          map((slug) => `/tracks/${slug}/data`),
          switchMap((url) =>
            concat(
              of(undefined),
              from(api.get(url)).pipe(
                catchError(() => {
                  return of(null);
                })
              )
            )
          ),
          startWith(undefined) // show track infos before track data is loaded
        );

        const comments$ = concat(of(null), reloadComments$).pipe(
          switchMap(() => slug$),
          map((slug) => `/tracks/${slug}/comments`),
          switchMap((url) =>
            from(api.get(url)).pipe(
              catchError(() => {
                return of(null);
              })
            )
          ),
          pluck("comments"),
          startWith(null) // show track infos before comments are loaded
        );

        return combineLatest([track$, trackData$, comments$]).pipe(
          map(([track, trackData, comments]) => ({
            track,
            trackData,
            comments,
          }))
        );
      },
      null,
      [slug]
    );

    const onSubmitComment = React.useCallback(
      async ({ body }) => {
        await api.post(`/tracks/${slug}/comments`, {
          body: { comment: { body } },
        });
        reloadComments();
      },
      [slug, reloadComments]
    );

    const onDeleteComment = React.useCallback(
      async (id) => {
        await api.delete(`/tracks/${slug}/comments/${id}`);
        reloadComments();
      },
      [slug, reloadComments]
    );

    const [downloadError, setDownloadError] = React.useState(null);
    const hideDownloadError = React.useCallback(
      () => setDownloadError(null),
      [setDownloadError]
    );
    const onDownload = React.useCallback(
      async (filename) => {
        try {
          await api.downloadFile(`/tracks/${slug}/download/${filename}`);
        } catch (err) {
          if (/Failed to fetch/.test(String(err))) {
            setDownloadError(t("TrackPage.downloadError"));
          } else {
            setDownloadError(String(err));
          }
        }
      },
      [slug]
    );

    const isAuthor = login?.id === data?.track?.author?.id;

    const { track, trackData, comments } = data || {};

    const loading = track == null || trackData === undefined;
    const processing = ["processing", "queued", "created"].includes(
      track?.processingStatus
    );
    const error = track?.processingStatus === "error";

    const [showTrack, setShowTrack] = React.useState(true);
    const [pointsMode, setPointsMode] = React.useState("overtakingEvents"); // none|overtakingEvents|measurements
    const [side, setSide] = React.useState("overtaker"); // overtaker|stationary

    const title = track ? track.title || t("general.unnamedTrack") : null;
    return (
      <Page
        title={title}
        stage={
          <>
            <Container>
              {track && (
                <Segment basic>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      marginBlockStart: 32,
                      marginBlockEnd: 16,
                    }}
                  >
                    <Header as="h1">{title}</Header>
                    <div style={{ marginLeft: "auto" }}>
                      <TrackActions {...{ isAuthor, onDownload, slug }} />
                    </div>
                  </div>

                  <div style={{ marginBlockEnd: 16 }}>
                    <TrackDetails {...{ track, isAuthor }} />
                  </div>
                </Segment>
              )}
            </Container>
            <div className={styles.stage}>
              <Loader active={loading} />
              <Dimmer.Dimmable blurring dimmed={loading}>
                <TrackMap
                  {...{ track, trackData, pointsMode, side, showTrack }}
                  style={{ height: "80vh" }}
                />
              </Dimmer.Dimmable>

              <div className={styles.details}>
                <Segment>
                  <TrackMapSettings
                    {...{
                      showTrack,
                      setShowTrack,
                      pointsMode,
                      setPointsMode,
                      side,
                      setSide,
                    }}
                  />
                </Segment>

                {processing && (
                  <Message warning>
                    <Message.Content>
                      {t("TrackPage.processing")}
                    </Message.Content>
                  </Message>
                )}

                {error && (
                  <Message error>
                    <Message.Content>
                      {t("TrackPage.processingError")}
                    </Message.Content>
                  </Message>
                )}
              </div>
            </div>

            <Container>
              {track?.description && (
                <>
                  <Header as="h2" dividing>
                    {t("TrackPage.description")}
                  </Header>
                  <Markdown>{track.description}</Markdown>
                </>
              )}

              <TrackComments
                {...{ hideLoader: loading, comments, login }}
                onSubmit={onSubmitComment}
                onDelete={onDeleteComment}
              />
            </Container>
          </>
        }
      >
        <Confirm
          open={downloadError != null}
          cancelButton={false}
          onConfirm={hideDownloadError}
          header={t("TrackPage.downloadFailed")}
          content={String(downloadError)}
          confirmButton={t("general.ok")}
        />
      </Page>
    );
  }
);

export default TrackPage;
