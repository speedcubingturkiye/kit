import './style.css';
import { EVENTS, TASK_LETTER, TEXT, fill, type Lang } from './i18n.ts';
import { badgePeople, fetchPublicWcif, indexActivities, parseWcif, roleOf, scheduleOf, type Task, type Wcif } from './wcif.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

let lang: Lang = 'tr';
try { if (localStorage.getItem('kit.lang') === 'en') lang = 'en'; } catch { /* storage blocked: keep Turkish */ }
let wcif: Wcif | null = null;
let statusKey: { key: keyof typeof TEXT.tr; status?: string } | null = null;

function t(key: keyof typeof TEXT.tr) {
  return TEXT[lang][key] as string;
}

function setStatus(key: keyof typeof TEXT.tr | null, status?: string) {
  statusKey = key ? { key, status } : null;
  $('status').textContent = key ? fill(t(key), { status: status ?? '' }) : '';
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
    wcif = await fetchPublicWcif(id);
    setStatus(null);
    history.replaceState(null, '', `?c=${encodeURIComponent(wcif.id)}`);
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
    setStatus(null);
  } catch {
    setStatus('badFile');
  }
  render();
}

function country(code: string) {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function render() {
  const out = $('out');
  out.replaceChildren();
  if (!wcif) {
    out.append(el('p', 'empty', t('empty')));
    return;
  }
  const people = badgePeople(wcif);
  const activities = indexActivities(wcif);
  const head = el('div', 'comp');
  head.append(el('h2', '', wcif.name));
  head.append(el('p', 'meta', [
    wcif.schedule.startDate,
    fill(t('days'), { n: wcif.schedule.numberOfDays }),
    fill(t('people'), { n: people.length }),
    `WCIF ${wcif.formatVersion}`,
  ].join(' · ')));
  out.append(head);

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
    tr.append(el('td', '', country(p.countryIso2)));
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
  out.append(wrap);
}

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
