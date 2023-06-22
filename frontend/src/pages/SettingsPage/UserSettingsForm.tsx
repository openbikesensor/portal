import React from "react";
import { connect } from "react-redux";
import {
  Segment,
  Message,
  Form,
  Button,
  TextArea,
  Ref,
  Input,
} from "semantic-ui-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { setLogin } from "reducers/login";
import api from "api";
import { findInput } from "utils";

const UserSettingsForm = connect((state) => ({ login: state.login }), {
  setLogin,
})(function UserSettingsForm({ login, setLogin, errors, setErrors }) {
  const { t } = useTranslation();
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = React.useState(false);

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

  return (
    <Segment style={{ maxWidth: 600 }}>
      <Form onSubmit={handleSubmit(onSave)} loading={loading}>
        <Form.Field error={errors?.username}>
          <label>{t("SettingsPage.profile.username.label")}</label>
          <Ref innerRef={findInput(register)}>
            <Input name="username" defaultValue={login.username} disabled />
          </Ref>
          <small>{t("SettingsPage.profile.username.hint")}</small>
        </Form.Field>

        <Message info visible>
          {t("SettingsPage.profile.publicNotice")}
        </Message>

        <Form.Field error={errors?.displayName}>
          <label>{t("SettingsPage.profile.displayName.label")}</label>
          <Ref innerRef={findInput(register)}>
            <Input
              name="displayName"
              defaultValue={login.displayName}
              placeholder={login.username}
            />
          </Ref>
          <small>{t("SettingsPage.profile.displayName.fallbackNotice")}</small>
        </Form.Field>

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
    </Segment>
  );
});
export default UserSettingsForm;
