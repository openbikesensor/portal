import React from 'react'
import {Comment} from 'semantic-ui-react'

import './styles.scss'

function hashCode(s) {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i)
    hash |= 0
  }
  return hash
}

function getColor(s) {
  const h = Math.floor(hashCode(s)) % 360
  return `hsl(${h}, 50%, 50%)`
}

export default function Avatar({user}) {
  const {image, username} = user || {}

  if (image) {
    return <Comment.Avatar src={image} />
  }

  if (!username) {
    return <div className="avatar empty-avatar" />
  }

  const color = getColor(username)

  return (
    <div className="avatar text-avatar" style={{background: color}}>
      {username && <span>{username[0]}</span>}
    </div>
  )
}
