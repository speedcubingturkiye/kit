import './style.css';
import badgeA from './designs/BadgeV1_1.dc.html?dc';
import badgeB from './designs/BadgeV2_1.dc.html?dc';
import certDesign from './designs/SertifikaKarma.dc.html?dc';
import { badgeComp, badgePerson, liveUrl, multiStage, sheetGrid, type BadgeLang } from './badge.ts';
import { certComp, certificates, signers, type Cert } from './certificate.ts';
import { renderDesign } from './dc.ts';
import { EVENTS, TASK_LETTER, TEXT, countryName, fill, type Lang } from './i18n.ts';
import { ICONS } from './icons.ts';
import { decidingResult, fetchLivePodiums, formatResult, podiumsFromWcif, type Podium } from './podium.ts';
import { qrPath } from './qr.ts';
import {
  badgePeople, fetchCompetitionInfo, fetchPublicWcif, indexActivities, parseWcif, roleOf, scheduleOf,
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
let city = '';
let previewAt = 0;
let certAt = 0;
let loadedAt = new Date();
// Podiums for the certificates: from the WCIF as loaded, or refreshed (from WCA Live for competitions scored there).
let podiums: { list: Podium[]; source: 'wcif' | 'live'; at: Date; note?: keyof typeof TEXT.tr } | null = null;
// Who signs the certificates, picked per competition; the first delegate and organiser by default.
let signPick: { delegate: string; organizer: string } | null = null;
// The view and the badge and certificate options live in the address, so a link or a reload keeps them.
const query = new URLSearchParams(location.search);
type View = 'people' | 'badges' | 'certificates';
const VIEWS: View[] = ['people', 'badges', 'certificates'];
let view: View = VIEWS.find((v) => v === query.get('v')) ?? 'people';
const badge = {
  design: (query.get('d') === 'B' ? 'B' : 'A') as keyof typeof DESIGNS,
  size: (query.get('s') ?? '') in SIZES ? (query.get('s') as string) : '9x12',
  land: query.get('o') === 'l',
  lang: (query.get('l') === 'tr-en' ? 'tr-en' : 'en') as BadgeLang,
  // Times and stages on the back, off unless ticked.
  times: query.get('t') === '1',
  stages: query.get('st') === '1',
};
// Certificate designs: the outer one draws the page (ground, frame, bands), the inner one writes on it; any of A-E
// goes with any. event narrows the preview and the print to one event ('' for all).
const CERT_DESIGNS = ['A', 'B', 'C', 'D', 'E'] as const;
type CertDesign = (typeof CERT_DESIGNS)[number];
const certDesignOf = (v: string | null, d: CertDesign) => CERT_DESIGNS.find((k) => k === v) ?? d;
const certOpts = { outer: certDesignOf(query.get('out'), 'C'), inner: certDesignOf(query.get('in'), 'B'), event: query.get('ev') ?? '' };
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
  if (view === 'certificates') {
    q.set('v', 'certificates');
    q.set('out', certOpts.outer);
    q.set('in', certOpts.inner);
    if (certOpts.event) q.set('ev', certOpts.event);
  }
  if (view === 'badges') {
    q.set('v', 'badges');
    q.set('d', badge.design);
    q.set('s', badge.size);
    q.set('o', badge.land ? 'l' : 'p');
    q.set('l', badge.lang);
    if (badge.times) q.set('t', '1');
    if (badge.stages) q.set('st', '1');
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
    const [w, info] = await Promise.all([fetchPublicWcif(id), fetchCompetitionInfo(id)]);
    wcif = w;
    ({ scoretaking, city } = info);
    previewAt = 0;
    certAt = 0;
    podiums = null;
    signPick = null;
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
    certAt = 0;
    podiums = null;
    signPick = null;
    loadedAt = new Date();
    setStatus(null);
    ({ scoretaking, city } = await fetchCompetitionInfo(wcif.id));
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
  const label = { people: 'viewPeople', badges: 'viewBadges', certificates: 'viewCertificates' } as const;
  for (const v of VIEWS) {
    const b = el('button', '', t(label[v]));
    b.setAttribute('type', 'button');
    b.setAttribute('aria-pressed', String(view === v));
    b.addEventListener('click', () => { view = v; syncUrl(); render(); });
    views.append(b);
  }
  out.append(head, views, ...(view === 'people' ? peopleTable(w, people) : view === 'badges' ? badgeView(w, people) : certView(w)));
}

// Certificates for every place of each finished final, one at a time in the preview; the print button makes them
// all, or one event's. Below, every final with its state and top three. WCA Live competitions are read live from WCA
// Live (the WCIF trails it until the next sync); for the others the WCIF is current, so a refresh reloads it.
function certView(w: Wcif) {
  let cur = w;
  let certs: Cert[] = [];
  const meta = el('p', 'hint');
  const list = el('div', 'podiums');
  const refresh = el('button', 'go', t('refresh'));
  refresh.setAttribute('type', 'button');
  const go = el('button', 'go', t('print'));
  go.setAttribute('type', 'button');
  go.addEventListener('click', () => printCertificates(cur, certs));
  const notes = el('div', 'notes');
  const nav = el('div', 'nav');
  const preview = el('div', 'preview');
  Object.assign(preview.dataset, { w: '297', h: '210', ph: '520' });
  previewFit.disconnect();
  previewFit.observe(preview);
  const pick = document.createElement('select');
  pick.id = 'preview-pick';
  const count = el('span', 'count');
  const events = document.createElement('select');
  const { delegates, organizers } = signers(w);
  // One person can be both; the organiser line then defaults to someone else when there is anyone.
  const signs = (signPick ??= { delegate: delegates[0] ?? '', organizer: organizers.find((n) => n !== delegates[0]) ?? organizers[0] ?? '' });
  const names = (people: string[]): [string, string][] => [...people.map((n): [string, string] => [n, n]), ['', '—']];
  const time = (d: Date) => d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const evName = (id: string) => EVENTS[id]?.[lang === 'tr' ? 1 : 2] ?? id;
  const draw = async () => {
    // In the competition's event order (WCA Live lists its podiums in its own).
    const order = cur.events.map((e) => e.id);
    const shown = [...(podiums?.list ?? podiumsFromWcif(cur))].sort((a, b) => order.indexOf(a.event) - order.indexOf(b.event));
    meta.textContent = fill(t(podiums?.source === 'live' ? 'sourceLive' : 'sourceWcif'), { time: time(podiums?.at ?? loadedAt) })
      + (podiums?.note ? ' ' + t(podiums.note) : '');
    list.replaceChildren(...(shown.length ? shown.map(podiumCard) : [el('p', 'empty', t('noRounds'))]));
    await loadFlags();
    const all = certificates(shown, certComp(cur, city), [[signs.delegate, 'WCA DELEGATE'], [signs.organizer, 'ORGANIZER']],
      (c) => (flags?.[c] ? svgUri(flags[c]) : ''), (e) => ICON_URIS[e] ?? '');
    const done = [...new Set(all.map((c) => c.event))];
    if (!done.includes(certOpts.event)) certOpts.event = '';
    syncUrl();
    events.replaceChildren(new Option(t('allEvents'), ''), ...done.map((e) => new Option(evName(e), e)));
    events.value = certOpts.event;
    certs = certOpts.event ? all.filter((c) => c.event === certOpts.event) : all;
    notes.replaceChildren(
      el('p', 'out', certs.length ? fill(t('outCerts'), { n: certs.length }) : t('noCerts')),
      el('p', 'hint', t('printCerts')),
    );
    nav.hidden = !certs.length;
    go.toggleAttribute('disabled', !certs.length);
    if (!certs.length) {
      preview.replaceChildren();
      return;
    }
    certAt = Math.min(certAt, certs.length - 1);
    pick.replaceChildren(...certs.map((c, i) => new Option(`${evName(c.event)} · ${c.place} · ${c.name}`, String(i))));
    pick.value = String(certAt);
    count.textContent = `${certAt + 1} / ${certs.length}`;
    const pair = el('div', 'pair');
    pair.append(renderDesign(certDesign, { outer: certOpts.outer, inner: certOpts.inner, cert: certs[certAt] }));
    preview.replaceChildren(pair);
    fitPreview(preview);
  };
  const arrow = (text: string, label: string, step: number) => {
    const b = el('button', 'step', text);
    b.setAttribute('type', 'button');
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => { certAt = (certAt + step + certs.length) % certs.length; draw(); });
    return b;
  };
  pick.addEventListener('change', () => { certAt = Number(pick.value); draw(); });
  const pickLabel = el('label', '', t('preview'));
  pickLabel.setAttribute('for', pick.id);
  const row = el('div', 'nav-row');
  row.append(arrow('‹', t('prevCert'), -1), pick, arrow('›', t('nextCert'), 1), count);
  nav.append(pickLabel, row);
  const evLabel = el('label');
  evLabel.append(el('span', '', t('certEvent')), events);
  events.addEventListener('change', () => { certOpts.event = events.value; certAt = 0; draw(); });
  const designs = CERT_DESIGNS.map((d): [string, string] => [d, d]);
  const opts = el('div', 'opts');
  opts.append(
    select(t('outer'), designs, certOpts.outer, (v) => { certOpts.outer = certDesignOf(v, 'C'); draw(); }),
    select(t('inner'), designs, certOpts.inner, (v) => { certOpts.inner = certDesignOf(v, 'B'); draw(); }),
    evLabel,
    select(t('signDelegate'), names(delegates), signs.delegate, (v) => { signs.delegate = v; draw(); }),
    select(t('signOrganizer'), names(organizers), signs.organizer, (v) => { signs.organizer = v; draw(); }),
    go,
  );
  const bar = el('div', 'opts');
  bar.append(refresh, meta);
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
  return [bar, opts, notes, nav, preview, el('h3', 'finals', t('finals')), list];
}

// A4 landscape, one certificate a page, edge to edge.
async function printCertificates(w: Wcif, certs: Cert[]) {
  if (!certs.length) return;
  pageStyle.textContent = '@page { size: 297mm 210mm; margin: 0; }';
  $('print').replaceChildren(...certs.map((c) =>
    page(297, 210, [[renderDesign(certDesign, { outer: certOpts.outer, inner: certOpts.inner, cert: c }), 0, 0]])));
  await document.fonts.load('800 10px Archivo', 'AaİıŞşĞğ');
  await document.fonts.ready;
  // The title becomes the PDF's file name.
  const title = document.title;
  document.title = [w.id, lang === 'tr' ? 'derece-belgeleri' : 'certificates', certOpts.outer + certOpts.inner, certOpts.event].filter(Boolean).join('-');
  window.print();
  document.title = title;
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
  const used = new Set<Task>();
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
      for (const [task, groups] of Object.entries(r.tasks) as [Task, number[]][]) {
        parts.push(`${TASK_LETTER[task]} ${groups.sort((a, b) => a - b).join(',')}`);
        used.add(task);
      }
      chip.textContent = parts.join(' · ');
      cell.append(chip);
    }
    tr.append(cell);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  const wrap = el('div', 'table-wrap');
  wrap.append(table);
  // The task letters this competition uses, in the letters' fixed order.
  const tasks = (Object.keys(TASK_LETTER) as Task[]).filter((k) => used.has(k));
  if (!tasks.length) return [wrap];
  return [wrap, el('p', 'hint', `${t('taskLegend')}: ${tasks.map((k) => `${TASK_LETTER[k]} ${TEXT[lang].tasks[k]}`).join(' · ')}`)];
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

// The preview shows a badge pair, or one certificate, in a box of fixed height whatever its size (data-w and data-h
// in mm, data-ph the height in px): a pair side by side, or stacked on narrow screens. Prints are real size; this is
// only the on-screen scale.
const PREVIEW_H = 420;
const previewFit = new ResizeObserver((entries) => entries.forEach((e) => fitPreview(e.target as HTMLElement)));
function fitPreview(preview: HTMLElement) {
  const pair = preview.firstElementChild as HTMLElement | null;
  if (!pair) return;
  const w = Number(preview.dataset.w);
  const h = Number(preview.dataset.h);
  const n = pair.childElementCount;
  const avail = preview.clientWidth;
  const stack = n > 1 && avail < 600;
  const gap = 10;
  const across = stack ? w * PX : n * w * PX + (n - 1) * gap;
  pair.classList.toggle('stack', stack);
  pair.style.zoom = String(Math.min((Number(preview.dataset.ph) || PREVIEW_H) / (h * PX), avail / across));
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
    const props = { ...shared, person: badgePerson(p, w, activities, badge.lang, flag ? svgUri(flag) : '', { times: badge.times, stages: badge.stages }) };
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

function checkbox(label: string, checked: boolean, set: (v: boolean) => void) {
  const l = el('label', 'check');
  const c = document.createElement('input');
  c.type = 'checkbox';
  c.checked = checked;
  c.addEventListener('change', () => set(c.checked));
  l.append(c, el('span', '', label));
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
    Object.assign(preview.dataset, { w: String(cw), h: String(ch) });
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
  // The back's time column, and its stage dots when the competition uses more than one stage (they need the times).
  const checks = el('div', 'checks');
  const stages = checkbox(t('showStages'), badge.stages, (v) => { badge.stages = v; draw(); });
  const stagesBox = stages.querySelector('input') as HTMLInputElement;
  stagesBox.disabled = !badge.times;
  checks.append(checkbox(t('showTimes'), badge.times, (v) => { badge.times = v; stagesBox.disabled = !v; draw(); }));
  if (multiStage(w)) checks.append(stages);
  const go = el('button', 'go', t('print'));
  go.setAttribute('type', 'button');
  go.addEventListener('click', () => printBadges(w, people));
  opts.append(checks, go);
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
