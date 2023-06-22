import React from "react";
import { Header } from "semantic-ui-react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";

import { Page } from "components";

export default function AcknowledgementsPage() {
  const { t } = useTranslation();
  const title = t("AcknowledgementsPage.title");

  return (
    <Page title={title}>
      <Header as="h2">{title}</Header>
      <Markdown>{t("AcknowledgementsPage.information")}</Markdown>
    </Page>
  );
}
