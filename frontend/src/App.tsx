import React from "react";
import classnames from "classnames";
import { connect } from "react-redux";
import {
  List,
  Grid,
  Container,
  Menu,
  Header,
  Dropdown,
} from "semantic-ui-react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import { useObservable } from "rxjs-hooks";
import { from } from "rxjs";
import { pluck } from "rxjs/operators";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";

import { useConfig } from "config";
import styles from "./App.module.less";
import { AVAILABLE_LOCALES, setLocale } from "i18n";

import {
  AcknowledgementsPage,
  ExportPage,
  HomePage,
  LoginRedirectPage,
  LogoutPage,
  NotFoundPage,
  MapPage,
  SettingsPage,
  TrackEditor,
  TrackPage,
  TracksPage,
  UploadPage,
  MyTracksPage,
} from "pages";
import { Avatar, LoginButton } from "components";
import api from "api";

// This component removes the "navigate" prop before rendering a Menu.Item,
// which is a workaround for an annoying warning that is somehow caused by the
// <Link /> and <Menu.Item /> combination.
function MenuItemForLink({ navigate, ...props }) {
  return (
    <Menu.Item
      {...props}
      onClick={(e) => {
        e.preventDefault();
        navigate();
      }}
    />
  );
}
function DropdownItemForLink({ navigate, ...props }) {
  return (
    <Dropdown.Item
      {...props}
      onClick={(e) => {
        e.preventDefault();
        navigate();
      }}
    />
  );
}

function Banner({
  text,
  style = "warning",
}: {
  text: string;
  style: "warning" | "info";
}) {
  return <div className={classnames(styles.banner, styles[style])}>{text}</div>;
}

const App = connect((state) => ({ login: state.login }))(function App({
  login,
}) {
  const { t } = useTranslation();
  const config = useConfig();
  const apiVersion = useObservable(() =>
    from(api.get("/info")).pipe(pluck("version"))
  );

  const hasMap = Boolean(config?.obsMapSource);

  React.useEffect(() => {
    api.loadUser();
  }, []);

  return config ? (
    <Router basename={config.basename}>
      <Helmet>
        <meta charSet="utf-8" />
        <title>OpenBikeSensor Portal</title>
      </Helmet>
      {config?.banner && <Banner {...config.banner} />}
      <Menu className={styles.menu} stackable>
        <Container>
          <Link
            to="/"
            component={MenuItemForLink}
            header
            className={styles.pageTitle}
          >
            OpenBikeSensor
          </Link>

          {hasMap && (
            <Link component={MenuItemForLink} to="/map" as="a">
              {t("App.menu.map")}
            </Link>
          )}

          <Link component={MenuItemForLink} to="/tracks" as="a">
            {t("App.menu.tracks")}
          </Link>

          <Link component={MenuItemForLink} to="/export" as="a">
            {t("App.menu.export")}
          </Link>

          <Menu.Menu position="right">
            {login ? (
              <>
                <Link component={MenuItemForLink} to="/my/tracks" as="a">
                  {t("App.menu.myTracks")}
                </Link>
                <Dropdown
                  item
                  trigger={<Avatar user={login} className={styles.avatar} />}
                >
                  <Dropdown.Menu>
                    <Link
                      to="/upload"
                      component={DropdownItemForLink}
                      icon="cloud upload"
                      text={t("App.menu.uploadTracks")}
                    />
                    <Link
                      to="/settings"
                      component={DropdownItemForLink}
                      icon="cog"
                      text={t("App.menu.settings")}
                    />
                    <Dropdown.Divider />
                    <Link
                      to="/logout"
                      component={DropdownItemForLink}
                      icon="sign-out"
                      text={t("App.menu.logout")}
                    />
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <Menu.Item>
                <LoginButton compact />
              </Menu.Item>
            )}
          </Menu.Menu>
        </Container>
      </Menu>

      <Switch>
        <Route path="/" exact>
          <HomePage />
        </Route>
        {hasMap && (
          <Route path="/map" exact>
            <MapPage />
          </Route>
        )}
        <Route path="/tracks" exact>
          <TracksPage />
        </Route>
        <Route path="/my/tracks" exact>
          <MyTracksPage />
        </Route>
        <Route path={`/tracks/:slug`} exact>
          <TrackPage />
        </Route>
        <Route path={`/tracks/:slug/edit`} exact>
          <TrackEditor />
        </Route>
        <Route path="/export" exact>
          <ExportPage />
        </Route>
        <Route path="/acknowledgements" exact>
          <AcknowledgementsPage />
        </Route>
        <Route path="/redirect" exact>
          <LoginRedirectPage />
        </Route>
        <Route path="/logout" exact>
          <LogoutPage />
        </Route>
        {login && (
          <>
            <Route path="/upload" exact>
              <UploadPage />
            </Route>
            <Route path="/settings" exact>
              <SettingsPage />
            </Route>
          </>
        )}
        <Route>
          <NotFoundPage />
        </Route>
      </Switch>

      <div className={styles.footer}>
        <Container>
          <Grid columns={4} stackable>
            <Grid.Row>
              <Grid.Column>
                <Header as="h5">{t("App.footer.aboutTheProject")}</Header>
                <List>
                  <List.Item>
                    <a
                      href="https://openbikesensor.org/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      openbikesensor.org
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">{t("App.footer.getInvolved")}</Header>
                <List>
                  <List.Item>
                    <a
                      href="https://forum.openbikesensor.org/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("App.footer.getHelpInForum")}
                    </a>
                  </List.Item>
                  <List.Item>
                    <a
                      href="https://github.com/openbikesensor/portal/issues/new"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("App.footer.reportAnIssue")}
                    </a>
                  </List.Item>
                  <List.Item>
                    <a
                      href="https://github.com/openbikesensor/portal"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("App.footer.development")}
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">{t("App.footer.thisInstallation")}</Header>
                <List>
                  <List.Item>
                    <a
                      href={config?.privacyPolicyUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("App.footer.privacyPolicy")}
                    </a>
                  </List.Item>
                  <List.Item>
                    <a
                      href={config?.imprintUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("App.footer.imprint")}
                    </a>
                  </List.Item>
                  {config?.termsUrl && (
                    <List.Item>
                      <a
                        href={config?.termsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("App.footer.terms")}
                      </a>
                    </List.Item>
                  )}
                  <List.Item>
                    <a
                      href={`https://github.com/openbikesensor/portal${
                        apiVersion ? `/releases/tag/${apiVersion}` : ""
                      }`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {apiVersion
                        ? t("App.footer.version", { apiVersion })
                        : t("App.footer.versionLoading")}
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">{t("App.footer.changeLanguage")}</Header>
                <List>
                  {AVAILABLE_LOCALES.map((locale) => (
                    <List.Item key={locale}>
                      <a onClick={() => setLocale(locale)}>
                        {t(`locales.${locale}`)}
                      </a>
                    </List.Item>
                  ))}
                </List>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Container>
      </div>
    </Router>
  ) : null;
});

export default App;
