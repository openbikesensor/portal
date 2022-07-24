import React from "react";
import {
  Message,
  Segment,
  Form,
  Button,
  Loader,
  Header,
  Comment,
} from "semantic-ui-react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";

import { Avatar, FormattedDate } from "components";

function CommentForm({ onSubmit }) {
  const { t } = useTranslation();
  const [body, setBody] = React.useState("");

  const onSubmitComment = React.useCallback(() => {
    onSubmit({ body });
    setBody("");
  }, [onSubmit, body]);

  return (
    <Form reply onSubmit={onSubmitComment}>
      <Form.TextArea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        content={t("TrackPage.comments.post")}
        labelPosition="left"
        icon="edit"
        primary
      />
    </Form>
  );
}

export default function TrackComments({
  comments,
  onSubmit,
  onDelete,
  login,
  hideLoader,
}) {
  const { t } = useTranslation();
  return (
    <>
      <Comment.Group>
        <Header as="h2" dividing>
          {t("TrackPage.comments.title")}
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
                      onDelete(comment.id);
                      e.preventDefault();
                    }}
                  >
                  {t('general.delete')}
                  </Comment.Action>
                </Comment.Actions>
              )}
            </Comment.Content>
          </Comment>
        ))}

        {comments != null && !comments.length && (
          <Message>{t("TrackPage.comments.empty")}</Message>
        )}

        {login && comments != null && <CommentForm onSubmit={onSubmit} />}
      </Comment.Group>
    </>
  );
}
