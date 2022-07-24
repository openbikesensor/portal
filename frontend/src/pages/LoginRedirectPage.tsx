import React from "react";
import { connect } from "react-redux";
import { Redirect, useLocation, useHistory } from "react-router-dom";
import { Icon, Message } from "semantic-ui-react";
import { useObservable } from "rxjs-hooks";
import { switchMap, pluck, distinctUntilChanged } from "rxjs/operators";
import { useTranslation } from "react-i18next";

import { Page } from "components";
import api from "api";

const LoginRedirectPage = connect((state) => ({
  loggedIn: Boolean(state.login),
}))(function LoginRedirectPage({ loggedIn }) {
  const location = useLocation();
  const history = useHistory();
  const { search } = location;
  const { t } = useTranslation();

  /* eslint-disable react-hooks/exhaustive-deps */

  // Hook dependency arrays in this block are intentionally left blank, we want
  // to keep the initial state, but reset the url once, ASAP, to not leak the
  // query parameters. This is considered good practice by OAuth.
  const searchParams = React.useMemo(
    () => Object.fromEntries(new URLSearchParams(search).entries()),
    []
  );

  React.useEffect(() => {
    history.replace({ ...location, search: "" });
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (loggedIn) {
    return <Redirect to="/" />;
  }

  const { error, error_description: errorDescription, code } = searchParams;

  if (error) {
    return (
      <Page small title={t("LoginRedirectPage.loginError")}>
        <LoginError errorText={errorDescription || error} />
      </Page>
    );
  }

  return <ExchangeAuthCode code={code} />;
});

function LoginError({ errorText }: { errorText: string }) {
  const { t } = useTranslation();
  return (
    <Message icon error>
      <Icon name="warning sign" />
      <Message.Content>
        <Message.Header>{t("LoginRedirectPage.loginError")}</Message.Header>
        {t("LoginRedirectPage.loginErrorText", { error: errorText })}
      </Message.Content>
    </Message>
  );
}

function ExchangeAuthCode({ code }) {
  const { t } = useTranslation();
  const result = useObservable(
    (_$, args$) =>
      args$.pipe(
        pluck(0),
        distinctUntilChanged(),
        switchMap((code) => api.exchangeAuthorizationCode(code))
      ),
    null,
    [code]
  );

  let content;
  if (result === null) {
    content = (
      <Message icon info>
        <Icon name="circle notched" loading />
        <Message.Content>
          <Message.Header>{t("LoginRedirectPage.loggingIn")}</Message.Header>
          {t("LoginRedirectPage.hangTight")}
        </Message.Content>
      </Message>
    );
  } else if (result === true) {
    content = <Redirect to="/" />;
  } else {
    const { error, error_description: errorDescription } = result;
    content = <LoginError errorText={errorDescription || error} />;
  }

  return (
    <Page small title="Login">
      {content}
    </Page>
  );
}

export default LoginRedirectPage;
