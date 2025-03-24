/// <reference types="react-scripts" />

declare module 'web-vitals';

interface Window {
  less: {
    modifyVars: (vars: Record<string, string>) => void;
  };
} 