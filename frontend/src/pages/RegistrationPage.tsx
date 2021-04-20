import React from 'react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

import api from 'api';
import { Page, RegistrationForm } from 'components';
import type { RootState } from '../store';

const RegistrationPage = connect((state: RootState) => ({ loggedIn: Boolean(state.login) }))(function RegistrationPage({
  loggedIn,
}) {
  const [message, setMessage] = React.useState();

  const onSubmit = React.useCallback(async ({ username, email, password }) => {
    const response = await api.post(`/accounts/register`, {
      body: { username, email, password, confirmPassword: password },
    });

    if (response && response.message) {
      setMessage(response.message);
    }
  }, []);

  return loggedIn ? (
    <Redirect to="/" />
  ) : (
    <Page small>
      <h2>Register</h2>
      {message ? message : <RegistrationForm onSubmit={onSubmit} />}
    </Page>
  );
});

export default RegistrationPage;
