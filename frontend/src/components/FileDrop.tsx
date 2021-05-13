// Source: https://github.com/sarink/react-file-drop/blob/master/file-drop/src/FileDrop.tsx
// Original License: MIT
// Adjusted to render prop instead of rendering div directly.

import PropTypes from 'prop-types'
import React, {DragEvent as ReactDragEvent, DragEventHandler as ReactDragEventHandler, ReactEventHandler} from 'react'

export type DropEffects = 'copy' | 'move' | 'link' | 'none'

export interface FileDropProps {
  frame?: Exclude<HTMLElementTagNameMap[keyof HTMLElementTagNameMap], HTMLElement> | HTMLDocument
  onFrameDragEnter?: (event: DragEvent) => void
  onFrameDragLeave?: (event: DragEvent) => void
  onFrameDrop?: (event: DragEvent) => void
  onDragOver?: ReactDragEventHandler<HTMLDivElement>
  onDragLeave?: ReactDragEventHandler<HTMLDivElement>
  onDrop?: (files: FileList | null, event: ReactDragEvent<HTMLDivElement>) => any
  onTargetClick?: ReactEventHandler<HTMLDivElement>
  dropEffect?: DropEffects
  children: (props: ChildrenProps) => React.ReactNode
}

export interface FileDropState {
  draggingOverFrame: boolean
  draggingOverTarget: boolean
}

export interface ChildrenProps extends FileDropState {
  onDragOver?: ReactDragEventHandler<HTMLDivElement>
  onDragLeave: ReactDragEventHandler<HTMLDivElement>
  onDrop: ReactDragEventHandler<HTMLDivElement>
  onClick: ReactEventHandler<HTMLDivElement>
}

export default class FileDrop extends React.PureComponent<FileDropProps, FileDropState> {
  static isIE = () =>
    typeof window !== 'undefined' &&
    (window.navigator.userAgent.indexOf('MSIE') !== -1 || window.navigator.appVersion.indexOf('Trident/') > 0)

  static eventHasFiles = (event: DragEvent | ReactDragEvent<HTMLElement>) => {
    // In most browsers this is an array, but in IE11 it's an Object :(
    let hasFiles = false
    if (event.dataTransfer) {
      const types = event.dataTransfer.types
      for (const keyOrIndex in types) {
        if (types[keyOrIndex] === 'Files') {
          hasFiles = true
          break
        }
      }
    }
    return hasFiles
  }

  static propTypes = {
    onDragOver: PropTypes.func,
    onDragLeave: PropTypes.func,
    onDrop: PropTypes.func,
    onTargetClick: PropTypes.func,
    dropEffect: PropTypes.oneOf(['copy', 'move', 'link', 'none']),
    frame: (props: FileDropProps, propName: keyof FileDropProps, componentName: string) => {
      const prop = props[propName]
      if (prop == null) {
        return new Error('Warning: Required prop `' + propName + '` was not specified in `' + componentName + '`')
      }
      if (prop !== document && !(prop instanceof HTMLElement)) {
        return new Error('Warning: Prop `' + propName + '` must be one of the following: document, HTMLElement!')
      }
    },
    onFrameDragEnter: PropTypes.func,
    onFrameDragLeave: PropTypes.func,
    onFrameDrop: PropTypes.func,
  }

  static defaultProps = {
    dropEffect: 'copy' as DropEffects,
    frame: typeof window === 'undefined' ? undefined : window.document,
  }

  constructor(props: FileDropProps) {
    super(props)
    this.frameDragCounter = 0
    this.state = {draggingOverFrame: false, draggingOverTarget: false}
  }

  componentDidMount() {
    this.startFrameListeners(this.props.frame)
    this.resetDragging()
    window.addEventListener('dragover', this.handleWindowDragOverOrDrop)
    window.addEventListener('drop', this.handleWindowDragOverOrDrop)
  }

  UNSAFE_componentWillReceiveProps(nextProps: FileDropProps) {
    if (nextProps.frame !== this.props.frame) {
      this.resetDragging()
      this.stopFrameListeners(this.props.frame)
      this.startFrameListeners(nextProps.frame)
    }
  }

  componentWillUnmount() {
    this.stopFrameListeners(this.props.frame)
    window.removeEventListener('dragover', this.handleWindowDragOverOrDrop)
    window.removeEventListener('drop', this.handleWindowDragOverOrDrop)
  }

  frameDragCounter: number

  resetDragging = () => {
    this.frameDragCounter = 0
    this.setState({draggingOverFrame: false, draggingOverTarget: false})
  }

  handleWindowDragOverOrDrop = (event: DragEvent) => {
    // This prevents the browser from trying to load whatever file the user dropped on the window
    event.preventDefault()
  }

  handleFrameDrag = (event: DragEvent) => {
    // Only allow dragging of files
    if (!FileDrop.eventHasFiles(event)) return

    // We are listening for events on the 'frame', so every time the user drags over any element in the frame's tree,
    // the event bubbles up to the frame. By keeping count of how many "dragenters" we get, we can tell if they are still
    // "draggingOverFrame" (b/c you get one "dragenter" initially, and one "dragenter"/one "dragleave" for every bubble)
    // This is far better than a "dragover" handler, which would be calling `setState` continuously.
    this.frameDragCounter += event.type === 'dragenter' ? 1 : -1

    if (this.frameDragCounter === 1) {
      this.setState({draggingOverFrame: true})
      if (this.props.onFrameDragEnter) this.props.onFrameDragEnter(event)
      return
    }

    if (this.frameDragCounter === 0) {
      this.setState({draggingOverFrame: false})
      if (this.props.onFrameDragLeave) this.props.onFrameDragLeave(event)
      return
    }
  }

  handleFrameDrop = (event: DragEvent) => {
    if (!this.state.draggingOverTarget) {
      this.resetDragging()
      if (this.props.onFrameDrop) this.props.onFrameDrop(event)
    }
  }

  handleDragOver: ReactDragEventHandler<HTMLDivElement> = (event) => {
    if (FileDrop.eventHasFiles(event)) {
      this.setState({draggingOverTarget: true})
      if (!FileDrop.isIE() && this.props.dropEffect) event.dataTransfer.dropEffect = this.props.dropEffect
      if (this.props.onDragOver) this.props.onDragOver(event)
    }
  }

  handleDragLeave: ReactDragEventHandler<HTMLDivElement> = (event) => {
    this.setState({draggingOverTarget: false})
    if (this.props.onDragLeave) this.props.onDragLeave(event)
  }

  handleDrop: ReactDragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault?.()
    if (this.props.onDrop && FileDrop.eventHasFiles(event)) {
      const files = event.dataTransfer ? event.dataTransfer.files : null
      this.props.onDrop(files, event)
    }
    this.resetDragging()
  }

  handleTargetClick: ReactEventHandler<HTMLDivElement> = (event) => {
    if (this.props.onTargetClick) {
      this.props.onTargetClick(event)
    }
    this.resetDragging()
  }

  stopFrameListeners = (frame: FileDropProps['frame']) => {
    if (frame) {
      frame.removeEventListener('dragenter', this.handleFrameDrag)
      frame.removeEventListener('dragleave', this.handleFrameDrag)
      frame.removeEventListener('drop', this.handleFrameDrop)
    }
  }

  startFrameListeners = (frame: FileDropProps['frame']) => {
    if (frame) {
      frame.addEventListener('dragenter', this.handleFrameDrag)
      frame.addEventListener('dragleave', this.handleFrameDrag)
      frame.addEventListener('drop', this.handleFrameDrop)
    }
  }

  render() {
    const {children} = this.props
    const {draggingOverTarget, draggingOverFrame} = this.state

    return children({
      draggingOverFrame,
      draggingOverTarget,
      onDragOver: this.handleDragOver,
      onDragLeave: this.handleDragLeave,
      onDrop: this.handleDrop,
      onClick: this.handleTargetClick,
    })
  }
}
