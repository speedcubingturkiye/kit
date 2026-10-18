// Design-canvas artboards, imported through the dc-html plugin in vite.config.ts.
declare module '*.dc.html?dc' {
  const design: import('./dc.ts').Design;
  export default design;
}
