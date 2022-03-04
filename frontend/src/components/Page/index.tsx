import React from "react";
import classnames from "classnames";
import { Container } from "semantic-ui-react";
import { Helmet } from "react-helmet";

import styles from "./Page.module.less";

export default function Page({
  small,
  children,
  fullScreen,
  stage,
  title,
}: {
  small?: boolean;
  children: ReactNode;
  fullScreen?: boolean;
  stage?: ReactNode;
  title?: string;
}) {
  return (
    <>
      {title && (
        <Helmet>
          <title>{title} - OpenBikeSensor Portal</title>
        </Helmet>
      )}
      <main
        className={classnames(
          styles.page,
          small && styles.small,
          fullScreen && styles.fullScreen,
          stage && styles.hasStage
        )}
      >
        {stage}
        {fullScreen ? children : <Container>{children}</Container>}
      </main>
    </>
  );
}
