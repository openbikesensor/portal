import React from 'react'
import {Segment, Form, Button, Loader, Header, Comment} from 'semantic-ui-react'

import {FormattedDate} from 'components'

function CommentForm({onSubmit}) {
  const [body, setBody] = React.useState('')

  const onSubmitComment = React.useCallback(() => {
    onSubmit({body})
    setBody('')
  }, [onSubmit, body])

  return (
    <Form reply onSubmit={onSubmitComment}>
      <Form.TextArea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      <Button content="Post comment" labelPosition="left" icon="edit" primary />
    </Form>
  )
}

export default function TrackComments({comments, onSubmit, onDelete, login, hideLoader}) {
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
              {login?.username === comment.author.username && (
                <Comment.Actions>
                <Comment.Action onClick={(e) => {
                  onDelete(comment.id)
                  e.preventDefault()
                }}>Delete</Comment.Action>
                </Comment.Actions>
              )}
            </Comment.Content>
          </Comment>
        ))}

        {login && comments != null && <CommentForm onSubmit={onSubmit} />}
      </Comment.Group>
    </Segment>
  )
}
