import './style.css';
import badgeA from './designs/BadgeV1_1.dc.html?dc';
import badgeB from './designs/BadgeV2_1.dc.html?dc';
import { badgeComp, badgePerson, liveUrl, sheetGrid, type BadgeLang } from './badge.ts';
import { renderDesign } from './dc.ts';
import { EVENTS, TASK_LETTER, TEXT, countryName, fill, type Lang } from './i18n.ts';
import { ICONS } from './icons.ts';
import { decidingResult, fetchLivePodiums, formatResult, podiumsFromWcif, type Podium } from './podium.ts';
import { qrPath } from './qr.ts';
import {
  badgePeople, fetchPublicWcif, fetchScoretaking, indexActivities, parseWcif, roleOf, scheduleOf,
  type Person, type Task, type Wcif,
} from './wcif.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// Badge designs A and B from the design canvas, and the card sizes in mm (portrait width, height).
const DESIGNS = { A: badgeA, B: badgeB };
const SIZES: Record<string, [number, number]> = {
  '9x12': [90, 120],
  '11x15': [110, 150],
  '9x13': [90, 130],
  A6: [105, 148],
  A7: [74, 105],
  CR80: [54, 85.6],
};
const sizeLabel = (k: string) => (/^\d+x\d+$/.test(k) ? `${k.replace('x', ' × ')} cm` : k);
const BLEED = 3;
const PX = 96 / 25.4;
const SVGNS = 'http://www.w3.org/2000/svg';
const svgUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
// Icons for the events the designs do not draw themselves (cubing/icons).
const ICON_URIS = Object.fromEntries(Object.entries(ICONS).map(([id, svg]) => [id, svgUri(svg)]));
// All 3:2 flags (country-flag-icons), one chunk fetched the first time badges are drawn.
let flags: Record<string, string> | null = null;
async function loadFlags() {
  if (flags) return;
  try {
    flags = { ...(await import('country-flag-icons/string/3x2')) } as Record<string, string>;
  } catch {
    flags = {}; // offline: the country name stays, without a flag
  }
}

let lang: Lang = 'tr';
try { if (localStorage.getItem('kit.lang') === 'en') lang = 'en'; } catch { /* storage blocked: keep Turkish */ }
let wcif: Wcif | null = null;
let scoretaking: string | null = null;
let previewAt = 0;
let loadedAt = new Date();
// Podiums shown in the podium view: from the WCIF as loaded, or refreshed (from WCA Live for competitions scored there).
let podiums: { list: Podium[]; source: 'wcif' | 'live'; at: Date; note?: keyof typeof TEXT.tr } | null = null;
// The view and the badge options live in the address, so a link or a reload keeps them.
const query = new URLSearchParams(location.search);
type View = 'people' | 'badges' | 'podiums';
const VIEWS: View[] = ['people', 'badges', 'podiums'];
let view: View = VIEWS.find((v) => v === query.get('v')) ?? 'people';
const badge = {
  design: (query.get('d') === 'B' ? 'B' : 'A') as keyof typeof DESIGNS,
  size: (query.get('s') ?? '') in SIZES ? (query.get('s') as string) : '9x12',
  land: query.get('o') === 'l',
  lang: (query.get('l') === 'tr-en' ? 'tr-en' : 'en') as BadgeLang,
};
let statusKey: { key: keyof typeof TEXT.tr; status?: string } | null = null;
const pageStyle = document.head.appendChild(document.createElement('style'));

function t(key: keyof typeof TEXT.tr) {
  return TEXT[lang][key] as string;
}

function setStatus(key: keyof typeof TEXT.tr | null, status?: string) {
  statusKey = key ? { key, status } : null;
  $('status').textContent = key ? fill(t(key), { status: status ?? '' }) : '';
}

function syncUrl() {
  if (!wcif) return;
  const q = new URLSearchParams({ c: wcif.id });
  if (view === 'podiums') q.set('v', 'podiums');
  if (view === 'badges') {
    q.set('v', 'badges');
    q.set('d', badge.design);
    q.set('s', badge.size);
    q.set('o', badge.land ? 'l' : 'p');
    q.set('l', badge.lang);
  }
  history.replaceState(null, '', `?${q}`);
}

// Static texts carry data-t attributes; everything else is rebuilt from the loaded WCIF.
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t as keyof typeof TEXT.tr); });
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  if (statusKey) setStatus(statusKey.key, statusKey.status);
  render();
}

async function loadById(id: string) {
  if (!id.trim()) return;
  setStatus('loading');
  try {
    [wcif, scoretaking] = await Promise.all([fetchPublicWcif(id), fetchScoretaking(id)]);
    previewAt = 0;
    podiums = null;
    loadedAt = new Date();
    setStatus(null);
    syncUrl();
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'not-found') setStatus('notFound');
    else if (msg.startsWith('http-')) setStatus('httpError', msg.slice(5));
    else if (msg === 'not-wcif') setStatus('badFile');
    else setStatus('netError');
  }
  render();
}

async function loadFile(file: File) {
  try {
    wcif = parseWcif(await file.text());
    previewAt = 0;
    podiums = null;
    loadedAt = new Date();
    setStatus(null);
    scoretaking = await fetchScoretaking(wcif.id);
  } catch {
    setStatus('badFile');
  }
  render();
}

function render() {
  const out = $('out');
  out.replaceChildren();
  if (!wcif) {
    out.append(el('p', 'empty', t('empty')));
    return;
  }
  const w = wcif;
  const people = badgePeople(w);
  const head = el('div', 'comp');
  head.append(el('h2', '', w.name));
  head.append(el('p', 'meta', [
    w.schedule.startDate,
    fill(t('days'), { n: w.schedule.numberOfDays }),
    fill(t('people'), { n: people.length }),
    `WCIF ${w.formatVersion}`,
  ].join(' · ')));
  const views = el('div', 'views');
  const label = { people: 'viewPeople', badges: 'viewBadges', podiums: 'viewPodiums' } as const;
  for (const v of VIEWS) {
    const b = el('button', '', t(label[v]));
    b.setAttribute('type', 'button');
    b.setAttribute('aria-pressed', String(view === v));
    b.addEventListener('click', () => { view = v; syncUrl(); render(); });
    views.append(b);
  }
  out.append(head, views, ...(view === 'people' ? [peopleTable(w, people)] : view === 'badges' ? badgeView(w, people) : podiumView(w)));
}

// Each event's final with its top three. WCA Live competitions are read live from WCA Live (the WCIF trails it until
// the next sync); for the others the WCIF is current, so a refresh reloads it.
function podiumView(w: Wcif) {
  let cur = w;
  const meta = el('p', 'hint');
  const list = el('div', 'podiums');
  const refresh = el('button', 'go', t('refresh'));
  refresh.setAttribute('type', 'button');
  const bar = el('div', 'opts');
  bar.append(refresh, meta);
  const time = (d: Date) => d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const draw = () => {
    const shown = podiums?.list ?? podiumsFromWcif(cur);
    meta.textContent = fill(t(podiums?.source === 'live' ? 'sourceLive' : 'sourceWcif'), { time: time(podiums?.at ?? loadedAt) })
      + (podiums?.note ? ' ' + t(podiums.note) : '');
    list.replaceChildren(...(shown.length ? shown.map(podiumCard) : [el('p', 'empty', t('noRounds'))]));
  };
  const update = async () => {
    refresh.setAttribute('disabled', '');
    const at = new Date();
    try {
      if (scoretaking === 'wca_live') {
        const live = await fetchLivePodiums(cur);
        podiums = live ? { list: live, source: 'live', at } : { list: podiumsFromWcif(cur), source: 'wcif', at: loadedAt, note: 'liveNotFound' };
      } else {
        cur = wcif = await fetchPublicWcif(cur.id);
        loadedAt = at;
        podiums = { list: podiumsFromWcif(cur), source: 'wcif', at };
      }
    } catch {
      podiums = { list: podiums?.list ?? podiumsFromWcif(cur), source: podiums?.source ?? 'wcif', at: podiums?.at ?? loadedAt, note: 'refreshError' };
    }
    refresh.removeAttribute('disabled');
    draw();
  };
  refresh.addEventListener('click', update);
  draw();
  if (scoretaking === 'wca_live' && !podiums) update();
  return [bar, list];
}

function podiumCard(p: Podium) {
  const card = el('section', `podium state-${p.state}`);
  const ev = EVENTS[p.event];
  const h = el('h3');
  h.append(el('span', '', ev ? ev[lang === 'tr' ? 1 : 2] : p.event), el('span', 'state', t(p.state === 'done' ? 'stateDone' : p.state === 'running' ? 'stateRunning' : 'stateWaiting')));
  card.append(h, el('p', 'round', fill(t('finalRound'), { n: p.round })));
  if (p.places.length) {
    const ol = el('ol', 'places');
    for (const x of p.places) {
      const { value, kind } = decidingResult(p.format, x);
      const li = el('li');
      li.append(
        el('span', 'place', String(x.place)),
        el('span', 'who', x.name),
        el('span', 'result', `${formatResult(value, p.event, kind !== 'single')} ${t(kind === 'single' ? 'kindSingle' : kind === 'mean' ? 'kindMean' : 'kindAverage')}`),
        el('span', 'country', countryName(x.country, lang)),
      );
      ol.append(li);
    }
    card.append(ol);
  }
  return card;
}

function peopleTable(w: Wcif, people: Person[]) {
  const activities = indexActivities(w);
  const table = el('table');
  const thead = el('thead');
  const hr = el('tr');
  for (const k of ['colNo', 'colName', 'colWcaId', 'colCountry', 'colRole', 'colGroups'] as const) hr.append(el('th', '', t(k)));
  thead.append(hr);
  const tbody = el('tbody');
  const li = lang === 'tr' ? 1 : 2;
  for (const p of people) {
    const tr = el('tr');
    tr.append(el('td', 'num', p.registrantId == null ? '–' : String(p.registrantId)));
    tr.append(el('td', 'name', p.name));
    tr.append(el('td', 'mono', p.wcaId ?? t('newcomer')));
    tr.append(el('td', '', countryName(p.countryIso2, lang)));
    const role = roleOf(p);
    tr.append(el('td', `role role-${role}`, TEXT[lang].roles[role]));
    const cell = el('td', 'groups');
    const rows = scheduleOf(p, activities);
    if (!rows.length) cell.append(el('span', 'none', t('noGroups')));
    for (const r of rows) {
      const ev = EVENTS[r.event];
      const chip = el('span', 'chip');
      chip.title = ev ? ev[li] : r.event;
      const parts = [`${ev ? ev[0] : r.event}${r.round ? ' R' + r.round : ''}`];
      if (r.group != null) parts.push(fill(t('group'), { n: r.group }) + (r.station != null ? ' ' + fill(t('station'), { n: r.station }) : ''));
      for (const [task, groups] of Object.entries(r.tasks) as [Task, number[]][]) parts.push(`${TASK_LETTER[task]} ${groups.sort((a, b) => a - b).join(',')}`);
      chip.textContent = parts.join(' · ');
      cell.append(chip);
    }
    tr.append(cell);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  const wrap = el('div', 'table-wrap');
  wrap.append(table);
  return wrap;
}

// The live-results link, or the competition page when that link is too long for the badge's QR.
function qrOf(w: Wcif) {
  for (const url of [liveUrl(w.id, scoretaking), liveUrl(w.id, null)]) {
    try {
      return { url, path: qrPath(url) };
    } catch { /* too long; the competition page always fits */ }
  }
  throw new Error('qr');
}

// The preview shows a badge pair in a box of fixed height whatever the card size: side by side, or stacked on
// narrow screens. Prints are real size; this is only the on-screen scale.
const PREVIEW_H = 420;
const previewFit = new ResizeObserver((entries) => entries.forEach((e) => fitPreview(e.target as HTMLElement)));
function fitPreview(preview: HTMLElement) {
  const pair = preview.firstElementChild as HTMLElement | null;
  if (!pair) return;
  const { w, h } = cardSize();
  const avail = preview.clientWidth;
  const stack = avail < 600;
  const gap = 10;
  const across = stack ? w * PX : 2 * w * PX + gap;
  pair.classList.toggle('stack', stack);
  pair.style.zoom = String(Math.min(PREVIEW_H / (h * PX), avail / across));
}

function cardSize() {
  const [a, b] = SIZES[badge.size];
  return badge.land ? { w: b, h: a } : { w: a, h: b };
}

// Front and back of every person's badge.
function cards(w: Wcif, people: Person[]): HTMLElement[][] {
  const activities = indexActivities(w);
  const shared = { ...cardSize(), lang: badge.lang, comp: badgeComp(w, badge.lang), qr: qrOf(w).path, icons: ICON_URIS };
  return people.map((p) => {
    const flag = flags?.[p.countryIso2];
    const props = { ...shared, person: badgePerson(p, w, activities, badge.lang, flag ? svgUri(flag) : '') };
    return (['front', 'back'] as const).map((face) => renderDesign(DESIGNS[badge.design], { ...props, face }));
  });
}

function select(label: string, options: [string, string][], value: string, set: (v: string) => void) {
  const l = el('label');
  const s = document.createElement('select');
  for (const [v, text] of options) s.append(new Option(text, v, false, v === value));
  s.addEventListener('change', () => set(s.value));
  l.append(el('span', '', label), s);
  return l;
}

// One person's badge at a time; the print button makes everyone's pages.
function badgeView(w: Wcif, people: Person[]) {
  const notes = el('div', 'notes');
  const nav = el('div', 'nav');
  const preview = el('div', 'preview');
  previewFit.disconnect();
  previewFit.observe(preview);
  const pick = document.createElement('select');
  pick.id = 'preview-pick';
  people.forEach((p, i) => pick.append(new Option(p.registrantId == null ? p.name : `${p.registrantId} · ${p.name}`, String(i))));
  const count = el('span', 'count');
  const draw = async () => {
    syncUrl();
    const { w: cw, h: ch } = cardSize();
    const grid = sheetGrid(cw, ch);
    notes.replaceChildren(
      el('p', 'out', onSheets()
        ? fill(t('outSheets'), { n: people.length, pages: Math.ceil(people.length / (grid.cols * grid.rows)) })
        : fill(t('outShop'), { n: people.length, pages: people.length * 2, w: (cw + 2 * BLEED).toLocaleString(lang), h: (ch + 2 * BLEED).toLocaleString(lang) })),
      el('p', 'hint', t(onSheets() ? 'printSheets' : 'printShop')),
      el('p', 'hint', fill(t('qrNote'), { url: qrOf(w).url }) + (scoretaking === 'wca_live' ? ' ' + t('qrWcaLive') : '')),
    );
    if (!people.length) return;
    previewAt = Math.min(previewAt, people.length - 1);
    pick.value = String(previewAt);
    count.textContent = `${previewAt + 1} / ${people.length}`;
    await loadFlags();
    const pair = el('div', 'pair');
    pair.append(...cards(w, [people[previewAt]])[0]);
    preview.replaceChildren(pair);
    fitPreview(preview);
  };
  const arrow = (text: string, label: string, step: number) => {
    const b = el('button', 'step', text);
    b.setAttribute('type', 'button');
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => { previewAt = (previewAt + step + people.length) % people.length; draw(); });
    return b;
  };
  pick.addEventListener('change', () => { previewAt = Number(pick.value); draw(); });
  if (people.length) {
    const label = el('label', '', t('preview'));
    label.setAttribute('for', pick.id);
    const row = el('div', 'nav-row');
    row.append(arrow('‹', t('prev'), -1), pick, arrow('›', t('next'), 1), count);
    nav.append(label, row);
  }
  const opts = el('div', 'opts');
  opts.append(
    select(t('design'), Object.keys(DESIGNS).map((k) => [k, k]), badge.design, (v) => { badge.design = v as keyof typeof DESIGNS; draw(); }),
    select(t('size'), Object.keys(SIZES).map((k) => [k, sizeLabel(k)]), badge.size, (v) => { badge.size = v; draw(); }),
    select(t('orientation'), [['p', t('portrait')], ['l', t('landscape')]], badge.land ? 'l' : 'p', (v) => { badge.land = v === 'l'; draw(); }),
    select(t('cardLang'), [['en', t('cardEn')], ['tr-en', t('cardTrEn')]], badge.lang, (v) => { badge.lang = v as BadgeLang; draw(); }),
  );
  const go = el('button', 'go', t('print'));
  go.setAttribute('type', 'button');
  go.addEventListener('click', () => printBadges(w, people));
  opts.append(go);
  draw();
  return [opts, notes, nav, preview];
}

// A6 and A7 go on A4 sheets to print at home; the other sizes go to the print shop as single cards with bleed.
const onSheets = () => badge.size === 'A6' || badge.size === 'A7';

async function printBadges(w: Wcif, people: Person[]) {
  const { w: cw, h: ch } = cardSize();
  await loadFlags();
  const faces = cards(w, people);
  const pages = onSheets() ? sheets(faces, cw, ch) : shopPages(faces.flat(), cw, ch);
  $('print').replaceChildren(...pages);
  // The bleed is measured, so Archivo (both subsets) must be in before the layout is read.
  await document.fonts.load('800 10px Archivo', 'AaİıŞşĞğ');
  await document.fonts.ready;
  if (!onSheets()) for (const page of pages) addBleed(page, cw, ch);
  // The title becomes the PDF's file name.
  const title = document.title;
  document.title = [w.id, lang === 'tr' ? 'yaka-kartlari' : 'badges', badge.design, badge.size].join('-');
  window.print();
  document.title = title;
}

function page(width: number, height: number, cards: [HTMLElement, number, number][]) {
  const p = el('div', 'page');
  p.style.width = `${width}mm`;
  p.style.height = `${height}mm`;
  for (const [card, x, y] of cards) {
    const wrap = el('div', 'card');
    wrap.style.left = `${x}mm`;
    wrap.style.top = `${y}mm`;
    wrap.append(card);
    p.append(wrap);
  }
  return p;
}

// Print shop: one page per face at trim size plus bleed.
function shopPages(cards: HTMLElement[], cw: number, ch: number) {
  pageStyle.textContent = `@page { size: ${cw + 2 * BLEED}mm ${ch + 2 * BLEED}mm; margin: 0; }`;
  return cards.map((card) => page(cw + 2 * BLEED, ch + 2 * BLEED, [[card, BLEED, BLEED]]));
}

// A4 sheets, as in Badgifier: each person's back and front side by side at real size, edge to edge, on whichever
// A4 orientation holds more people. Cut along the dashed lines, then fold each piece in the middle.
function sheets(faces: HTMLElement[][], cw: number, ch: number) {
  const { pw, ph, cols, rows } = sheetGrid(cw, ch);
  pageStyle.textContent = `@page { size: ${pw}mm ${ph}mm; margin: 0; }`;
  const cellW = pw / cols;
  const cellH = ph / rows;
  const cut = (cls: string, side: 'left' | 'top', mm: number) => {
    const d = el('div', `cut ${cls}`);
    d.style[side] = `${mm}mm`;
    return d;
  };
  const out: HTMLElement[] = [];
  for (let i = 0; i < faces.length; i += cols * rows) {
    const placed: [HTMLElement, number, number][] = [];
    faces.slice(i, i + cols * rows).forEach(([front, back], k) => {
      const x = (k % cols) * cellW + (cellW - 2 * cw) / 2;
      const y = Math.floor(k / cols) * cellH + (cellH - ch) / 2;
      placed.push([back, x, y], [front, x + cw, y]);
    });
    const sheet = page(pw, ph, placed);
    for (let c = 1; c < cols; c++) sheet.append(cut('cut-v', 'left', c * cellW));
    for (let r = 1; r < rows; r++) sheet.append(cut('cut-h', 'top', r * cellH));
    out.push(sheet);
  }
  return out;
}

// 3 mm bleed: every coloured box that touches a trim edge is extended outward behind the card, and the watermark
// may run on past the trim instead of being clipped there.
function addBleed(page: HTMLElement, w: number, h: number) {
  const wrap = page.firstElementChild as HTMLElement;
  const card = wrap.firstElementChild as HTMLElement;
  card.style.overflow = 'visible';
  const body = card.querySelector<HTMLElement>('[data-name="body"]');
  if (body) body.style.overflow = 'visible';
  const o = card.getBoundingClientRect();
  for (const e of [card, ...card.querySelectorAll('*')]) {
    if (e.namespaceURI === SVGNS) continue;
    const bg = getComputedStyle(e).backgroundColor;
    if (!bg || bg === 'transparent' || /,\s*0\)$/.test(bg)) continue;
    const r = e.getBoundingClientRect();
    const L = (r.left - o.left) / PX;
    const T = (r.top - o.top) / PX;
    const R = (r.right - o.left) / PX;
    const B = (r.bottom - o.top) / PX;
    const tl = L < 0.05;
    const tt = T < 0.05;
    const tr = R > w - 0.05;
    const tb = B > h - 0.05;
    if (!(tl || tt || tr || tb)) continue;
    const d = el('div', 'bleed');
    d.style.cssText = `background:${bg};left:${BLEED + L - (tl ? BLEED : 0)}mm;top:${BLEED + T - (tt ? BLEED : 0)}mm;`
      + `width:${R - L + (tl ? BLEED : 0) + (tr ? BLEED : 0)}mm;height:${B - T + (tt ? BLEED : 0) + (tb ? BLEED : 0)}mm`;
    page.insertBefore(d, wrap);
  }
}

addEventListener('afterprint', () => $('print').replaceChildren());
$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  loadById($<HTMLInputElement>('comp').value);
});
$<HTMLInputElement>('file').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) loadFile(f);
});
document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang as Lang;
  try { localStorage.setItem('kit.lang', lang); } catch { /* not saved; fine */ }
  applyLang();
}));

applyLang();
const fromUrl = new URLSearchParams(location.search).get('c');
if (fromUrl) {
  $<HTMLInputElement>('comp').value = fromUrl;
  loadById(fromUrl);
}
