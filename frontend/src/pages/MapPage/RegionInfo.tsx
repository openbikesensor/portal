import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import _ from "lodash";
import { List, Header, Icon, Button } from "semantic-ui-react";
import { useTranslation } from "react-i18next";

import styles from "./styles.module.less";

export default function RegionInfo({ region, mapInfoPortal, onClose }) {
  const { t } = useTranslation();
  const content = (
    <>
      <div className={styles.closeHeader}>
        <Header as="h3">{region.properties.name || t(`MapPage.regionInfo.unnamedRegion`)}</Header>
        <Button primary icon onClick={onClose}>
          <Icon name="close" />
        </Button>
      </div>

      <List>
        <List.Item>
          <List.Header>{t(`MapPage.regionInfo.eventNumber`)}</List.Header>
          <List.Content>{region.properties.overtaking_event_count ?? 0}</List.Content>
        </List.Item>
      </List>
    </>
  );

  return content && mapInfoPortal
    ? createPortal(
        <div className={styles.mapInfoBox}>{content}</div>,
        mapInfoPortal
      )
    : null;
}
