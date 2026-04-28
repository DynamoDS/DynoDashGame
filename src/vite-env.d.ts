/// <reference types="vite/client" />

declare module "*.dyn?raw" {
  const src: string;
  export default src;
}
