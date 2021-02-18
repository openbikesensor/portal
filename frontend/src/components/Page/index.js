import React from 'react'
import classnames from 'classnames'

import styles from './Page.module.scss'

export default function Page({small, children}) {
  return <main className={classnames(styles.page, small && styles.small)}>{children}</main>
}
