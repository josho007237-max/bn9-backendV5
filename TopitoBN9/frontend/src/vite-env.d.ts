/// <reference types="vite/client" />

import type { FunctionComponent, SVGAttributes } from 'react';

declare module '*.svg' {
  const content: FunctionComponent<SVGAttributes<SVGElement>>;
  export default content;
}
