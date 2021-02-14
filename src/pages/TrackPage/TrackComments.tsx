import React from 'react'
import {Segment, Form, Button, Loader, Header, Comment} from 'semantic-ui-react'

import {FormattedDate} from 'components'

export default function TrackComments({comments, login, hideLoader}) {
  return (
    <Segment basic>
      <Comment.Group>
        <Header as="h2" dividing>
          Comments
        </Header>

        <Loader active={!hideLoader && comments == null} inline />

        {comments?.map((comment: TrackComment) => (
          <Comment key={comment.id}>
            <Comment.Avatar src={comment.author.image} />
            <Comment.Content>
              <Comment.Author as="a">{comment.author.username}</Comment.Author>
              <Comment.Metadata>
                <div>
                  <FormattedDate date={comment.createdAt} relative />
                </div>
              </Comment.Metadata>
              <Comment.Text>{comment.body}</Comment.Text>
            </Comment.Content>
          </Comment>
        ))}

        {login && comments != null && (
          <Form reply>
            <Form.TextArea rows={4} />
            <Button content="Post comment" labelPosition="left" icon="edit" primary />
          </Form>
        )}
      </Comment.Group>
    </Segment>
  )
}
