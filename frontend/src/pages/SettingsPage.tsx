import React from "react";
import { connect } from "react-redux";
import {
  Message,
  Icon,
  Grid,
  Form,
  Button,
  TextArea,
  Ref,
  Input,
  Header,
  Divider,
  Popup,
} from "semantic-ui-react";
import { useForm } from "react-hook-form";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";

import { setLogin } from "reducers/login";
import { Page, Stats } from "components";
import api from "api";
import { findInput } from "utils";
import { useConfig } from "config";

const SettingsPage = connect((state) => ({ login: state.login }), { setLogin })(
  function SettingsPage({ login, setLogin }) {
    const { t } = useTranslation();
    const { register, handleSubmit } = useForm();
    const [loading, setLoading] = React.useState(false);
    const [errors, setErrors] = React.useState(null);

    const onSave = React.useCallback(
      async (changes) => {
        setLoading(true);
        setErrors(null);
        try {
          const response = await api.put("/user", { body: changes });
          setLogin(response);
        } catch (err) {
          setErrors(err.errors);
        } finally {
          setLoading(false);
        }
      },
      [setLoading, setLogin, setErrors]
    );

    const onGenerateNewKey = React.useCallback(async () => {
      setLoading(true);
      setErrors(null);
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
    }, [setLoading, setLogin, setErrors]);

    return (
      <Page title={t("SettingsPage.title")}>
        <Grid centered relaxed divided stackable>
          <Grid.Row>
            <Grid.Column width={8}>
              <Header as="h2">{t("SettingsPage.profile.title")}</Header>

              <Message info>{t("SettingsPage.profile.publicNotice")}</Message>

              <Form onSubmit={handleSubmit(onSave)} loading={loading}>
                <Ref innerRef={findInput(register)}>
                  <Form.Input
                    error={errors?.username}
                    label={t("SettingsPage.profile.username.label")}
                    name="username"
                    defaultValue={login.username}
                    disabled
                  />
                </Ref>
                <Form.Field error={errors?.bio}>
                  <label>{t("SettingsPage.profile.bio.label")}</label>
                  <Ref innerRef={register}>
                    <TextArea name="bio" rows={4} defaultValue={login.bio} />
                  </Ref>
                </Form.Field>
                <Form.Field error={errors?.image}>
                  <label>{t("SettingsPage.profile.avatarUrl.label")}</label>
                  <Ref innerRef={findInput(register)}>
                    <Input name="image" defaultValue={login.image} />
                  </Ref>
                </Form.Field>

                <Button type="submit" primary>
                  {t("general.save")}
                </Button>
              </Form>
            </Grid.Column>
            <Grid.Column width={6}>
              <ApiKeyDialog {...{ login, onGenerateNewKey }} />

              <Divider />

              <Stats user={login.username} />
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Page>
    );
  }
);

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
      content={success ? t('general.copied') : t('general.copyError')}
    />
  );
}

const selectField = findInput((ref) => ref?.select());

function ApiKeyDialog({ login, onGenerateNewKey }) {
  const { t } = useTranslation();
  const config = useConfig();
  const [show, setShow] = React.useState(false);
  const onClick = React.useCallback(
    (e) => {
      e.preventDefault();
      setShow(true);
    },
    [setShow]
  );

  const onGenerateNewKeyInner = React.useCallback(
    (e) => {
      e.preventDefault();
      onGenerateNewKey();
    },
    [onGenerateNewKey]
  );

  return (
    <>
      <Header as="h2">{t("SettingsPage.apiKey.title")}</Header>
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
      <Button onClick={onGenerateNewKeyInner}>
        {t("SettingsPage.apiKey.generate")}
      </Button>
    </>
  );
}

export default SettingsPage;
