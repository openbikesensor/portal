import React from "react";
import { connect } from "react-redux";
import {
  Message,
  Icon,
  Button,
  Ref,
  Input,
  Segment,
  Popup,
} from "semantic-ui-react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";

import { setLogin } from "reducers/login";
import api from "api";
import { findInput } from "utils";
import { useConfig } from "config";

function CopyInput({ value, ...props }) {
  const { t } = useTranslation();
  const [success, setSuccess] = React.useState(null);
  const onClick = async () => {
    try {
      await window.navigator?.clipboard?.writeText(value);
      setSuccess(true);
    } catch (err) {
      setSuccess(false);
    } finally {
      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    }
  };

  return (
    <Popup
      trigger={
        <Input
          {...props}
          value={value}
          fluid
          action={{ icon: "copy", onClick }}
        />
      }
      position="top right"
      open={success != null}
      content={success ? t("general.copied") : t("general.copyError")}
    />
  );
}

const selectField = findInput((ref) => ref?.select());

const ApiKeySettings = connect((state) => ({ login: state.login }), {
  setLogin,
})(function ApiKeySettings({ login, setLogin, setErrors }) {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const config = useConfig();
  const [show, setShow] = React.useState(false);
  const onClick = React.useCallback(
    (e) => {
      e.preventDefault();
      setShow(true);
    },
    [setShow]
  );

  const onGenerateNewKey = React.useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const response = await api.put("/user", {
          body: { updateApiKey: true },
        });
        setLogin(response);
      } catch (err) {
        setErrors(err.errors);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setLogin, setErrors]
  );

  return (
    <Segment style={{ maxWidth: 600, margin: "24px auto" }}>
      <Markdown>{t("SettingsPage.apiKey.description")}</Markdown>
      <div style={{ minHeight: 40, marginBottom: 16 }}>
        {show ? (
          login.apiKey ? (
            <Ref innerRef={selectField}>
              <CopyInput
                label={t("SettingsPage.apiKey.key.label")}
                value={login.apiKey}
              />
            </Ref>
          ) : (
            <Message warning content={t("SettingsPage.apiKey.key.empty")} />
          )
        ) : (
          <Button onClick={onClick}>
            <Icon name="lock" /> {t("SettingsPage.apiKey.key.show")}
          </Button>
        )}
      </div>
      <Markdown>{t("SettingsPage.apiKey.urlDescription")}</Markdown>
      <div style={{ marginBottom: 16 }}>
        <CopyInput
          label={t("SettingsPage.apiKey.url.label")}
          value={config?.apiUrl?.replace(/\/api$/, "") ?? "..."}
        />
      </div>
      <Markdown>{t("SettingsPage.apiKey.generateDescription")}</Markdown>
      <p></p>
      <Button onClick={onGenerateNewKey}>
        {t("SettingsPage.apiKey.generate")}
      </Button>
    </Segment>
  );
});

export default ApiKeySettings;
