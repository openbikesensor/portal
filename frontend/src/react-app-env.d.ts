/// <reference types="node" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare const __webpack_public_path__: string

type ReactNode = import('react').ReactNode
type ViewPortRef = any

declare module '*.module.less' {
  const classes: {[key: string]: string}
  export default classes
}

declare module '*.less' {
  const content: any
  export default content
}

declare module '*.css' {
  const content: any
  export default content
}

declare module '*.yaml' {
  const data: any
  export default data
}

declare module '*.yml' {
  const data: any
  export default data
}

declare module '*.json' {
  const value: any
  export default value
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module 'downloadjs' {
  export default function download(data: any, strFileName?: string, strMimeType?: string): any
}
