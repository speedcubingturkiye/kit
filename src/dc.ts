// Renders a design-canvas artboard with its component's values: {{ holes }} in text and attributes, <sc-if value>,
// <sc-for list as>, and style holes that take objects. Style holes also name their element (data-name), which the
// print bleed uses. The markup and the Component class come from a .dc.html file through vite.config.ts.

export type Vals = { [key: string]: unknown };
export type Design = { markup: string; Component: new (props: Vals) => { renderVals(): Vals } };

const SVGNS = 'http://www.w3.org/2000/svg';
const HOLE = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/;
const HOLES = /\{\{\s*([\w.$]+)\s*\}\}/g;
const templates = new Map<string, DocumentFragment>();

const lookup = (scope: Vals, path: string) => path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Vals)[k]), scope);
const str = (v: unknown) => (v == null ? '' : String(v));
const fillHoles = (s: string, scope: Vals) => s.replace(HOLES, (_, p: string) => str(lookup(scope, p)));

export const css = (o: Vals) => Object.keys(o)
  .filter((k) => o[k] != null && o[k] !== '')
  .map((k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) + ':' + o[k])
  .join(';');

export function renderDesign(design: Design, props: Vals): HTMLElement {
  let tpl = templates.get(design.markup);
  if (!tpl) {
    const t = document.createElement('template');
    t.innerHTML = design.markup;
    tpl = t.content;
    templates.set(design.markup, tpl);
  }
  const out = document.createElement('div');
  render(tpl, new design.Component(props).renderVals(), out);
  return out.firstElementChild as HTMLElement;
}

function render(node: Node, scope: Vals, out: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(document.createTextNode(fillHoles(child.nodeValue ?? '', scope)));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const src = child as Element;
    const tag = src.localName;
    if (tag === 'sc-if') {
      const m = HOLE.exec(src.getAttribute('value') ?? '');
      if (m && lookup(scope, m[1])) render(src, scope, out);
      continue;
    }
    if (tag === 'sc-for') {
      const m = HOLE.exec(src.getAttribute('list') ?? '');
      const as = src.getAttribute('as') ?? 'item';
      const list = m ? lookup(scope, m[1]) : undefined;
      for (const item of Array.isArray(list) ? list : []) render(src, { ...scope, [as]: item }, out);
      continue;
    }
    const el = src.namespaceURI === SVGNS ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
    for (const a of Array.from(src.attributes)) {
      if (a.name.startsWith('hint-')) continue;
      const m = HOLE.exec(a.value);
      if (!m) {
        el.setAttribute(a.name, fillHoles(a.value, scope));
        continue;
      }
      const v = lookup(scope, m[1]);
      if (a.name === 'style' && v && typeof v === 'object') {
        el.setAttribute('style', css(v as Vals));
        el.setAttribute('data-name', m[1].split('.').pop() ?? '');
      } else if (v != null) {
        el.setAttribute(a.name, String(v));
      }
    }
    render(src, scope, el);
    out.appendChild(el);
  }
}
