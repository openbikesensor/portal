import React from 'react'
import classnames from 'classnames'
import {connect} from 'react-redux'
import {List, Grid, Container, Menu, Header, Dropdown} from 'semantic-ui-react'
import {BrowserRouter as Router, Routes, Route, Link} from 'react-router-dom'
import {useObservable} from 'rxjs-hooks'
import {from, map} from 'rxjs'
import {Helmet} from 'react-helmet'
import {useTranslation} from 'react-i18next'

import {useConfig} from 'config'
import styles from './App.module.less'
import {AVAILABLE_LOCALES, setLocale} from 'i18n'

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
} from 'pages'
import {Avatar, LoginButton} from 'components'
import api from 'api'

function Banner({text, style = 'warning'}: {text: string; style?: 'warning' | 'info'}) {
  return <div className={classnames(styles.banner, styles[style])}>{text}</div>
}

const LOCALE_NAMES = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
} as const

const App = connect((state: any) => ({login: state.login}))(function App({login}: {login?: any}) {
  const {t} = useTranslation()
  const config = useConfig()
  const apiVersion = useObservable(() => from(api.get('/info')).pipe(map((res: any) => res?.version)))

  const hasMap = Boolean(config?.obsMapSource)

  React.useEffect(() => {
    api.loadUser()
  }, [])

  return config ? (
    <Router basename={config.basename}>
      <Helmet>
        <meta charSet="utf-8" />
        <title>OpenBikeSensor Portal</title>
      </Helmet>
      {config?.banner && <Banner {...config.banner} />}
      <Menu className={styles.menu} stackable>
        <Container>
          <Link to="/">
            <Menu.Item header className={styles.pageTitle}>
              OpenBikeSensor
            </Menu.Item>
          </Link>

          {hasMap && (
            <Link to="/map">
              <Menu.Item>{t('App.menu.map')}</Menu.Item>
            </Link>
          )}

          <Link to="/tracks">
            <Menu.Item>{t('App.menu.tracks')}</Menu.Item>
          </Link>

          <Link to="/export">
            <Menu.Item>{t('App.menu.export')}</Menu.Item>
          </Link>

          <Menu.Menu position="right">
            {login ? (
              <>
                <Link to="/my/tracks">
                  <Menu.Item>{t('App.menu.myTracks')}</Menu.Item>
                </Link>
                <Dropdown item trigger={<Avatar user={login} className={styles.avatar} />}>
                  <Dropdown.Menu>
                    <Link to="/upload">
                      <Dropdown.Item icon="cloud upload" text={t('App.menu.uploadTracks')} />
                    </Link>
                    <Link to="/settings">
                      <Dropdown.Item icon="cog" text={t('App.menu.settings')} />
                    </Link>
                    <Dropdown.Divider />
                    <Link to="/logout">
                      <Dropdown.Item icon="sign-out" text={t('App.menu.logout')} />
                    </Link>
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

      <Routes>
        <Route path="/" element={<HomePage />} />
        {hasMap && <Route path="/map" element={<MapPage />} />}
        <Route path="/tracks" element={<TracksPage />} />
        <Route path="/my/tracks" element={<MyTracksPage />} />
        <Route path="/tracks/:slug" element={<TrackPage />} />
        <Route path="/tracks/:slug/edit" element={<TrackEditor />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/acknowledgements" element={<AcknowledgementsPage />} />
        <Route path="/redirect" element={<LoginRedirectPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        {login && (
          <>
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </>
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <div className={styles.footer}>
        <Container>
          <Grid columns={4} stackable>
            <Grid.Row>
              <Grid.Column>
                <Header as="h5">{t('App.footer.aboutTheProject')}</Header>
                <List>
                  <List.Item>
                    <a href="https://openbikesensor.org/" target="_blank" rel="noreferrer">
                      openbikesensor.org
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">{t('App.footer.getInvolved')}</Header>
                <List>
                  <List.Item>
                    <a href="https://forum.openbikesensor.org/" target="_blank" rel="noreferrer">
                      {t('App.footer.getHelpInForum')}
                    </a>
                  </List.Item>
                  <List.Item>
                    <a href="https://github.com/openbikesensor/portal/issues/new" target="_blank" rel="noreferrer">
                      {t('App.footer.reportAnIssue')}
                    </a>
                  </List.Item>
                  <List.Item>
                    <a href="https://github.com/openbikesensor/portal" target="_blank" rel="noreferrer">
                      {t('App.footer.development')}
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">{t('App.footer.thisInstallation')}</Header>
                <List>
                  <List.Item>
                    <a href={config?.privacyPolicyUrl} target="_blank" rel="noreferrer">
                      {t('App.footer.privacyPolicy')}
                    </a>
                  </List.Item>
                  <List.Item>
                    <a href={config?.imprintUrl} target="_blank" rel="noreferrer">
                      {t('App.footer.imprint')}
                    </a>
                  </List.Item>
                  {config?.termsUrl && (
                    <List.Item>
                      <a href={config?.termsUrl} target="_blank" rel="noreferrer">
                        {t('App.footer.terms')}
                      </a>
                    </List.Item>
                  )}
                  <List.Item>
                    <a
                      href={`https://github.com/openbikesensor/portal${
                        apiVersion ? `/releases/tag/${apiVersion}` : ''
                      }`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {apiVersion ? t('App.footer.version', {apiVersion}) : t('App.footer.versionLoading')}
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">{t('App.footer.changeLanguage')}</Header>
                <List>
                  {AVAILABLE_LOCALES.map((locale) => (
                    <List.Item key={locale}>
                      <a onClick={() => setLocale(locale)}>{LOCALE_NAMES[locale]}</a>
                    </List.Item>
                  ))}
                </List>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Container>
      </div>
    </Router>
  ) : null
})

export default App
