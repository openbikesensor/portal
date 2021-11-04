import React from 'react'
import classnames from 'classnames'
import {Container} from 'semantic-ui-react'

import styles from './Page.module.scss'

export default function Page({small, children, fullScreen}: {small?: boolean, children: ReactNode, fullScreen?: boolean}) {
  return (
    <main className={classnames(styles.page, small && styles.small, fullScreen && styles.fullScreen)}>
      {fullScreen ? children : <Container>{children}</Container>}
    </main>
  )
}
