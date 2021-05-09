import React from 'react'
import {connect} from 'react-redux'
import {List, Grid, Container, Menu, Icon, Button, Header} from 'semantic-ui-react'
import {BrowserRouter as Router, Switch, Route, Link} from 'react-router-dom'

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

const App = connect((state) => ({login: state.login}))(function App({login}) {
  return (
    <Router basename={process.env.PUBLIC_URL || '/'}>
      <Menu fixed="top">
        <Container>
          <Menu.Item header className={styles.pageTitle}>
            <Link to="/">OpenBikeSensor</Link>
          </Menu.Item>

          <Link component={Menu.Item} to="/tracks">
            Tracks
          </Link>

          {login ? (
            <Menu.Menu position="right">
              <Link to="/upload" component={Menu.Item}>
                <Button compact primary>
                  <Icon name="cloud upload" />
                  Upload
                </Button>
              </Link>

              <Link to="/settings" component={Menu.Item}>
                <Avatar user={login} className={styles.avatar} />
              </Link>

              <Link component={Menu.Item} to="/logout">
                <Button compact>Logout</Button>
              </Link>
            </Menu.Menu>
          ) : (
            <Menu.Menu>
              <Menu.Item>
                <LoginButton as="a" compact />
              </Menu.Item>
            </Menu.Menu>
          )}
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
                <Header as='h5'>About the project</Header>
                <List>
                  <List.Item>
                    <a href="https://openbikesensor.org/" target="_blank" rel="noreferrer">
                      openbikesensor.org
                    </a>
                  </List.Item>
                </List>
              </Grid.Column>

              <Grid.Column>
                <Header as='h5'>Get involved</Header>
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
                <Header as='h5'>This installation</Header>
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
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Container>
      </div>
    </Router>
  )
})

export default App
