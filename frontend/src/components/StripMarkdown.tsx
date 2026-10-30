import React from 'react'
import Markdown from 'react-markdown'

const _noop = ({children}) => <>{children}</>
const _space = () => <> </>
const _spaced = ({children}) => <>{children} </>

const components = {
  p: _spaced,
  span: _noop,
  strong: _noop,
  em: _noop,
  a: _noop,
  ul: _spaced,
  ol: _spaced,
  li: _noop,
  blockquote: _noop,
  h1: _noop,
  h2: _noop,
  h3: _noop,
  h4: _noop,
  h5: _noop,
  h6: _noop,
  code: _noop,
  pre: _noop,
  hr: _space,
  br: _space,
}

export default function StripMarkdown({children}: {children: string | null}) {
  if (!children) return null
  return (
    <Markdown components={components}>
      {children}
    </Markdown>
  )
}
