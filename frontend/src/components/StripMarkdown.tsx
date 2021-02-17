import React from 'react'
import Markdown from 'react-markdown'

const _noop = ({children}) => <>{children}</>
const _space = () => <> </>
const _spaced = ({children}) => (
  <>
    {children.map((child, i) => (
      <React.Fragment key={i}>{child} </React.Fragment>
    ))}
  </>
)

const stripMarkdownNodes = {
  root: _noop,
  text: _noop,
  break: _space,
  paragraph: _spaced,
  emphasis: _noop,
  strong: _noop,
  thematicBreak: _space,
  blockquote: _noop,
  link: _noop,
  list: _spaced,
  listItem: _noop,
  definition: _noop,
  heading: _noop,
  inlineCode: _noop,
  code: _noop,
}
const stripTypes = Array.from(Object.keys(stripMarkdownNodes))

export default function StripMarkdown({children}) {
  return (
    <Markdown allowedTypes={stripTypes} renderers={stripMarkdownNodes}>
      {children}
    </Markdown>
  )
}
