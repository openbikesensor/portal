import React from 'react'
import classnames from 'classnames'
import {Container} from 'semantic-ui-react'

import styles from './Page.module.scss'

export default function Page({small, children}: {small?: boolean, children: ReactNode}) {
  return (
    <main className={classnames(styles.page, small && styles.small)}>
      <Container>{children}</Container>
    </main>
  )
}
