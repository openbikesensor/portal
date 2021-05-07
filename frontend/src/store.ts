import { applyMiddleware, createStore, compose } from 'redux';
import { save, load } from 'redux-localstorage-simple';

import rootReducer from './reducers';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

const composeEnhancers =
  (process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;

export const store = createStore(
  rootReducer,
  load({ states: ['login'], disableWarnings: true }),
  composeEnhancers(applyMiddleware(save({ states: ['login'] }))),
);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
