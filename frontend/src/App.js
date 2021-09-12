import React from 'react'
import {connect} from 'react-redux'
import {List, Grid, Container, Menu, Header, Dropdown} from 'semantic-ui-react'
import {BrowserRouter as Router, Switch, Route, Link} from 'react-router-dom'
import {useObservable} from 'rxjs-hooks'
import {from} from 'rxjs'
import {pluck} from 'rxjs/operators'

import config from 'config.json'
import styles from './App.module.scss'

import {
  HomePage,
  LoginRedirectPage,
  LogoutPage,
  NotFoundPage,
  SettingsPage,
  TrackEditor,
  TrackPage,
  TracksPage,
  UploadPage,
} from 'pages'
import {Avatar, LoginButton} from 'components'
import api from 'api'

import packageJson from '../package.json'

const {version} = packageJson

// This component removes the "navigate" prop before rendering a Menu.Item,
// which is a workaround for an annoying warning that is somehow caused by the
// <Link /> and <Menu.Item /> combination.
function MenuItemForLink({navigate, ...props}) {
  return <Menu.Item {...props} />
}
function DropdownItemForLink({navigate, ...props}) {
  return <Dropdown.Item {...props} />
}

const App = connect((state) => ({login: state.login}))(function App({login}) {
  const apiVersion = useObservable(() => from(api.get('/info')).pipe(pluck('version')))

  return (
    <Router basename={process.env.PUBLIC_URL || '/'}>
      <Menu fixed="top">
        <Container>
          <Link to="/" component={MenuItemForLink} header className={styles.pageTitle}>
            OpenBikeSensor
          </Link>

          <Link component={MenuItemForLink} to="/tracks" as="a">
            Tracks
          </Link>

          <Menu.Menu position="right">
            {login ? (
              <Dropdown item trigger={<Avatar user={login} className={styles.avatar} />}>
                <Dropdown.Menu>
                  <Link to="/upload" component={DropdownItemForLink} icon="cloud upload" text="Upload tracks" />
                  <Link to="/settings" component={DropdownItemForLink} icon="cog" text="Settings" />
                  <Dropdown.Divider />
                  <Link to="/logout" component={DropdownItemForLink} icon="sign-out" text="Logout" />
                </Dropdown.Menu>
              </Dropdown>
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
        <Route path="/tracks" exact>
          <TracksPage />
        </Route>
        <Route path="/my/tracks" exact>
          <TracksPage privateTracks />
        </Route>
        <Route path={`/tracks/:slug`} exact>
          <TrackPage />
        </Route>
        <Route path={`/tracks/:slug/edit`} exact>
          <TrackEditor />
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
                <Header as="h5">About the project</Header>
                <List>
                  <List.Item>
                    <a href="https://openbikesensor.org/" target="_blank" rel="noreferrer">
                      openbikesensor.org
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">Get involved</Header>
                <List>
                  <List.Item>
                    <a href="https://openbikesensor.org/slack" target="_blank" rel="noreferrer">
                      Slack
                    </a>
                  </List.Item>
                  <List.Item>
                    <a href="https://github.com/openbikesensor/portal/issues/new" target="_blank" rel="noreferrer">
                      Report an issue
                    </a>
                  </List.Item>
                  <List.Item>
                    <a href="https://github.com/openbikesensor/portal" target="_blank" rel="noreferrer">
                      Development
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">This installation</Header>
                <List>
                  <List.Item>
                    <a href={config.privacyPolicyUrl} target="_blank" rel="noreferrer">
                      Privacy policy
                    </a>
                  </List.Item>
                  <List.Item>
                    <a href={config.imprintUrl} target="_blank" rel="noreferrer">
                      Imprint
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as="h5">Info</Header>
                <List>
                  <List.Item>
                    <a href={`https://github.com/openbikesensor/portal/releases/tag/v${version}`} target="_blank" rel="noreferrer">
                      Frontend v{version}
                    </a>
                  </List.Item>
                  <List.Item>
                    <a href={`https://github.com/openbikesensor/portal${apiVersion ? `/releases/tag/v${apiVersion}` : ''}`} target="_blank" rel="noreferrer">
                      API v{apiVersion ?? '...'}
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Container>
      </div>
    </Router>
  )
})

export default App
