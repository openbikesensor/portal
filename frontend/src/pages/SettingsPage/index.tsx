import React from "react";
import { connect } from "react-redux";
import { Header, Tab } from "semantic-ui-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { setLogin } from "reducers/login";
import { Page, Stats } from "components";
import api from "api";

import ApiKeySettings from "./ApiKeySettings";

import UserSettingsForm from "./UserSettingsForm";

const SettingsPage = connect((state) => ({ login: state.login }), { setLogin })(
  function SettingsPage({ login, setLogin }) {
    const { t } = useTranslation();
    const { register, handleSubmit } = useForm();
    const [loading, setLoading] = React.useState(false);
    const [errors, setErrors] = React.useState(null);

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
        <Header as="h1">{t("SettingsPage.title")}</Header>
        <Tab
          menu={{ secondary: true, pointing: true }}
          panes={[
            {
              menuItem: t("SettingsPage.profile.title"),
              render: () => <UserSettingsForm {...{ errors, setErrors }} />,
            },

            {
              menuItem: t("SettingsPage.apiKey.title"),
              render: () => <ApiKeySettings {...{ errors, setErrors }} />,
            },

            {
              menuItem: t("SettingsPage.stats.title"),
              render: () => <Stats user={login.id} />,
            },
          ]}
        />
      </Page>
    );
  }
);

export default SettingsPage;
