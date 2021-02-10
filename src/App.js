import React from 'react'
import {connect} from 'react-redux'
import {Item, Tab, Button, Loader, Pagination, Icon} from 'semantic-ui-react'
import {useObservable} from 'rxjs-hooks'
import {BrowserRouter as Router, Switch, Route, Link, useParams, useHistory, useRouteMatch} from 'react-router-dom'
import {of, from, concat} from 'rxjs'
import {map, switchMap, distinctUntilChanged, debounceTime} from 'rxjs/operators'
import _ from 'lodash'

import {Page} from './components'
import styles from './App.module.scss'
import api from './api'

import {LoginPage, LogoutPage, NotFoundPage} from './pages'
import {useQueryParam, stringifyParams} from './query.ts'

function TracksPageTabs() {
  const history = useHistory()
  const panes = React.useMemo(
    () => [
      {menuItem: 'Global Feed', url: '/'},
      {menuItem: 'Your Feed', url: '/my-tracks'},
    ],
    []
  )

  const onTabChange = React.useCallback(
    (e, data) => {
      history.push(panes[data.activeIndex].url)
    },
    [history, panes]
  )

  const isFeedPage = useRouteMatch('/my-tracks')
  const activeIndex = isFeedPage ? 1 : 0

  return <Tab menu={{secondary: true, pointing: true}} {...{panes, onTabChange, activeIndex}} />
}

function TrackList({path}) {
  const [page, setPage] = useQueryParam('page', 1)

  const privateFeed = path === '/my-tracks'
  const pageSize = 20

  const data = useObservable(
    (_$, inputs$) =>
      inputs$.pipe(
        map(([page, privateFeed]) => {
          const url = '/tracks' + (privateFeed ? '/feed' : '')
          const params = {limit: pageSize, offset: pageSize * (page - 1)}
          return {url, params}
        }),
        debounceTime(100),
        distinctUntilChanged(_.isEqual),
        switchMap((request) => concat(of(null), from(api.fetch(request.url + '?' + stringifyParams(request.params)))))
      ),
    null,
    [page, privateFeed]
  )

  const {tracks, trackCount} = data || {}
  const loading = !data

  const totalPages = trackCount / pageSize

  return (
    <div>
      <Loader content="Loading" active={loading} />
      {!loading && totalPages > 1 && <Pagination activePage={page} onPageChange={setPage} totalPages={totalPages} />}

      {tracks && (
        <Item.Group divided>
          {tracks.map((track) => (
            <Item key={track.slug}>
              <Item.Image size="tiny" src={track.author.image} />
              <Item.Content>
                <Item.Header as="a">{track.title}</Item.Header>
                <Item.Meta>
                  Created by {track.author.username} on {track.createdAt}
                </Item.Meta>
                <Item.Description>{track.description}</Item.Description>
                <Item.Extra>
                  {track.visible ? (
                    <>
                      <Icon color="blue" name="eye" fitted /> Public
                    </>
                  ) : (
                    <>
                      <Icon name="eye slash" fitted /> Private
                    </>
                  )}
                </Item.Extra>
              </Item.Content>
            </Item>
          ))}
        </Item.Group>
      )}
    </div>
  )
}

function PublicTracksPage({login}) {
  return (
    <Page>
      {login ? <TracksPageTabs /> : null}
      <TrackList path="/" />
    </Page>
  )
}

function OwnTracksPage({login}) {
  return (
    <Page>
      {login ? <TracksPageTabs /> : null}
      <TrackList path="/my-tracks" />
    </Page>
  )
}

function Track() {
  let {slug} = useParams()
  return <h3>Track {slug}</h3>
}

const App = connect((state) => ({login: state.login}))(function App({login}) {
  // update the API header on each render, the App is rerendered when the login changes
  if (login) {
    api.setAuthorizationHeader('Token ' + login.token)
  } else {
    api.setAuthorizationHeader(null)
  }

  return (
    <Router>
      <div>
        <header className={styles.header}>
          <div className={styles.pageTitle}>OpenBikeSensor</div>
          <nav className={styles.menu}>
            <ul>
              <li>
                <Link to="/">Feed</Link>
              </li>
              <li>
                <Link to="https://openbikesensor.org/">About</Link>
              </li>
              {login ? (
                <>
                  <li>
                    <Link to="/settings">Settings</Link>
                  </li>
                  <li>
                    <Button as={Link} to="/logout">
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
        </header>

        <Switch>
          <Route path="/" exact>
            <PublicTracksPage {...{login}} />
          </Route>
          <Route path="/my-tracks">
            <OwnTracksPage {...{login}} />
          </Route>
          <Route path={`/track/:slug`}>
            <Track />
          </Route>
          <Route path="/login">
            <LoginPage />
          </Route>
          <Route path="/logout">
            <LogoutPage />
          </Route>
          <Route>
            <NotFoundPage />
          </Route>
        </Switch>
      </div>
    </Router>
  )
})

export default App
