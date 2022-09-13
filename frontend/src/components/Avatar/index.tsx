import React from "react";
import { Comment } from "semantic-ui-react";
import classnames from "classnames";

import "./styles.less";

function hashCode(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getColor(s) {
  const h = Math.floor(hashCode(s)) % 360;
  return `hsl(${h}, 50%, 50%)`;
}

export default function Avatar({ user, className }) {
  const { image, displayName } = user || {};

  if (image) {
    return <Comment.Avatar src={image} className={className} />;
  }

  if (!displayName) {
    return <div className={classnames(className, "avatar", "empty-avatar")} />;
  }

  const color = getColor(displayName);

  return (
    <div
      className={classnames(className, "avatar", "text-avatar")}
      style={{ background: color }}
    >
      {displayName && <span>{displayName[0]}</span>}
    </div>
  );
}
