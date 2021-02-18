import React from 'react'
import {connect} from 'react-redux'
import {Icon, Button} from 'semantic-ui-react'
import {BrowserRouter as Router, Switch, Route, Link} from 'react-router-dom'

import styles from './App.module.scss'
import api from './api'

import {
  LoginPage,
  LogoutPage,
  NotFoundPage,
  TracksPage,
  TrackPage,
  HomePage,
  UploadPage,
  RegistrationPage,
} from './pages'

const App = connect((state) => ({login: state.login}))(function App({login}) {
  // update the API header on each render, the App is rerendered when the login changes
  if (login) {
    api.setAuthorizationHeader('Token ' + login.token)
  } else {
    api.setAuthorizationHeader(null)
  }

  return (
    <Router>
      <div className={styles.App}>
        <header className={styles.headline}>
          <div className={styles.header}>
            <div className={styles.pageTitle}>OpenBikeSensor</div>
            <nav className={styles.menu}>
              <ul>
                {login && (
                  <li>
                    <Link to="/upload">
                      <Button compact color="green">
                        <Icon name="cloud upload" />
                        Upload
                      </Button>
                    </Link>
                  </li>
                )}
                <li>
                  <Link to="/">Home</Link>
                </li>
                <li>
                  <Link to="/feed">Feed</Link>
                </li>
                <li>
                  <a href="https://openbikesensor.org/" target="_blank" rel="noreferrer">
                    About
                  </a>
                </li>
                {login ? (
                  <>
                    <li>
                      <Link to="/settings">Settings</Link>
                    </li>
                    <li>
                      <Button as={Link} to="/logout" compact>
                        Logout
                      </Button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Button as={Link} to="/login">
                        Login
                      </Button>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </div>
        </header>

        <Switch>
          <Route path="/" exact>
            <HomePage />
          </Route>
          <Route path="/feed" exact>
            <TracksPage />
          </Route>
          <Route path="/feed/my" exact>
            <TracksPage privateFeed />
          </Route>
          <Route path={`/tracks/:slug`} exact>
            <TrackPage />
          </Route>
          <Route path="/register" exact>
            <RegistrationPage />
          </Route>
          <Route path="/login" exact>
            <LoginPage />
          </Route>
          <Route path="/logout" exact>
            <LogoutPage />
          </Route>
          {login && (
            <Route path="/upload" exact>
              <UploadPage />
            </Route>
          )}
          <Route>
            <NotFoundPage />
          </Route>
        </Switch>
      </div>
    </Router>
  )
})

export default App
