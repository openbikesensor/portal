import React from 'react'
import {Icon, Segment, Header, Button} from 'semantic-ui-react'

import {FileDrop} from 'components'

export default function FileUploadField({onSelect: onSelect_, multiple}) {
  const labelRef = React.useRef()
  const [labelRefState, setLabelRefState] = React.useState()

  const onSelect = multiple ? onSelect_ : (files) => onSelect_(files?.[0])

  React.useLayoutEffect(
    () => {
      setLabelRefState(labelRef.current)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labelRef.current]
  )

  function onChangeField(e) {
    e.preventDefault?.()

    if (e.target.files && e.target.files.length) {
      onSelect(e.target.files)
    }
    e.target.value = '' // reset the form field for uploading again
  }

  return (
    <>
      <input
        type="file"
        id="upload-field"
        style={{width: 0, height: 0, position: 'fixed', left: -1000, top: -1000, opacity: 0.001}}
        multiple={multiple}
        accept=".csv"
        onChange={onChangeField}
      />
      <label htmlFor="upload-field" ref={labelRef}>
        {labelRefState && (
          <FileDrop onDrop={onSelect} frame={labelRefState}>
            {({draggingOverFrame, draggingOverTarget, onDragOver, onDragLeave, onDrop, onClick}) => (
              <Segment
                placeholder
                {...{onDragOver, onDragLeave, onDrop}}
                style={{
                  background: draggingOverTarget || draggingOverFrame ? '#E0E0EE' : null,
                  transition: 'background 0.2s',
                }}
              >
                <Header icon>
                  <Icon name="cloud upload" />
                  Drop file{multiple ? 's' : ''} here or click to select {multiple ? 'them' : 'one'} for upload
                </Header>

                <Button primary as="span">
                  Upload file{multiple ? 's' : ''}
                </Button>
              </Segment>
            )}
          </FileDrop>
        )}
      </label>
    </>
  )
}
