import React from 'react'
import {Message, Segment, Form, Button, Loader, Header, Comment} from 'semantic-ui-react'
import Markdown from 'react-markdown'

import {Avatar, FormattedDate} from 'components'

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
    <>
      <Comment.Group>
        <Header as="h2" dividing>
          Comments
        </Header>

        <Loader active={!hideLoader && comments == null} inline />

        {comments?.map((comment: TrackComment) => (
          <Comment key={comment.id}>
            <Avatar user={comment.author} />
            <Comment.Content>
              <Comment.Author as="a">{comment.author.username}</Comment.Author>
              <Comment.Metadata>
                <div>
                  <FormattedDate date={comment.createdAt} relative />
                </div>
              </Comment.Metadata>
              <Comment.Text>
                <Markdown>{comment.body}</Markdown>
              </Comment.Text>
              {login?.username === comment.author.username && (
                <Comment.Actions>
                  <Comment.Action
                    onClick={(e) => {
                      onDelete(comment.id)
                      e.preventDefault()
                    }}
                  >
                    Delete
                  </Comment.Action>
                </Comment.Actions>
              )}
            </Comment.Content>
          </Comment>
        ))}

        {comments != null && !comments.length && <Message>Nobody commented... yet</Message>}

        {login && comments != null && <CommentForm onSubmit={onSubmit} />}
      </Comment.Group>
    </>
  )
}
