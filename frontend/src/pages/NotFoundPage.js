import React from 'react'
import {Button, Header} from 'semantic-ui-react'
import {useHistory} from 'react-router-dom'
import { useTranslation } from "react-i18next";

import {Page} from '../components'

export default function NotFoundPage() {
  const { t } = useTranslation();
  const history = useHistory()
  return (
    <Page title={t('NotFoundPage.title')}>
      <Header as="h2">{t('NotFoundPage.title')}</Header>
      <p>{t('NotFoundPage.description')}</p>
      <Button onClick={history.goBack.bind(history)}>{t('NotFoundPage.goBack')}</Button>
    </Page>
  )
}
