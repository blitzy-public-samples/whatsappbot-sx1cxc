/// <reference types="vite/client" /> // vite ^4.0.0

/**
 * Enhanced type declaration for Vite environment variables with strict typing
 * Extends base environment record with application-specific environment variables
 */
interface ImportMetaEnv extends Record<string, string> {
  /** Application environment - strictly typed to allowed values */
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
  
  /** Base URL for API endpoints */
  readonly VITE_API_URL: string;
  
  /** WebSocket connection URL */
  readonly VITE_WS_URL: string;
  
  /** Application version from package.json */
  readonly VITE_APP_VERSION: string;
  
  /** Build timestamp */
  readonly VITE_BUILD_TIME: string;
}

/**
 * Extended type declaration for Vite import.meta object
 * Includes environment variables and hot reload functionality
 */
interface ImportMeta {
  /** Typed environment variables */
  readonly env: ImportMetaEnv;
  
  /** Hot module replacement API */
  readonly hot: {
    readonly accept: () => void;
  };
}

/**
 * Type declaration for static image imports with metadata
 * Supports responsive images and lazy loading
 */
interface StaticImageData {
  /** Image source URL */
  src: string;
  
  /** Image width in pixels */
  width: number;
  
  /** Image height in pixels */
  height: number;
  
  /** Base64 encoded blur placeholder */
  blurDataURL: string;
  
  /** Loading strategy indicator */
  loading: boolean;
}

/**
 * SVG module declaration with React component typing
 * Supports title and description props for accessibility
 */
declare module '*.svg' {
  import type { FC, SVGProps } from 'react';
  
  const SVGComponent: FC<SVGProps<SVGSVGElement> & {
    title?: string;
    desc?: string;
  }>;
  
  export default SVGComponent;
}

/**
 * Static image format module declarations
 * Supports PNG, JPG, JPEG, and WebP formats
 */
declare module '*.png' {
  const content: StaticImageData;
  export default content;
}

declare module '*.jpg' {
  const content: StaticImageData;
  export default content;
}

declare module '*.jpeg' {
  const content: StaticImageData;
  export default content;
}

declare module '*.webp' {
  const content: StaticImageData;
  export default content;
}