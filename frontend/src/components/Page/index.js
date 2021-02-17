import React from 'react'
import styles from './Page.module.scss'

export default function Page({children}) {
  return <main className={styles.page}>{children}</main>
}
