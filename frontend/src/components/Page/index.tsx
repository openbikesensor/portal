import React from 'react'
import classnames from 'classnames'
import {Container} from 'semantic-ui-react'

import styles from './Page.module.less'

export default function Page({
  small,
  children,
  fullScreen,
  stage,
}: {
  small?: boolean
  children: ReactNode
  fullScreen?: boolean
  stage?: ReactNode
}) {
  return (
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
  )
}
