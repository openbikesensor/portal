import React from 'react'
import classnames from 'classnames'

import styles from './Page.module.scss'

export default function Page({children, small = false}: {children: React.ReactNode, small?: boolean }) {
  return <main className={classnames(styles.page, small && styles.small)}>{children}</main>
}
