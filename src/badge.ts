// Badge data from the WCIF, in the shape the badge designs take as props (person, comp, qr).

import { TASK_LETTER, countryName } from './i18n.ts';
import { roleOf, scheduleOf, type ActivityInfo, type Person, type Task, type Wcif } from './wcif.ts';

export type BadgeLang = 'en' | 'tr-en';
export type BadgeRow = [event: string, group: string, task: string];
export type BadgePerson = {
  name: string;
  wcaId: string;
  id: string;
  country: string;
  countryName: string;
  flag: string;
  role: string;
  rows: BadgeRow[];
};

// One row per event, in the competition's order, from the first round: the group ('' until groups are assigned,
// '–' in an event the person does not compete in) and the tasks, e.g. 'J 1,3' or '–'.
export function badgeRows(p: Person, w: Wcif, activities: Map<number, ActivityInfo>): BadgeRow[] {
  const first = scheduleOf(p, activities).filter((r) => r.round === 1);
  const rows: BadgeRow[] = [];
  for (const { id } of w.events) {
    const r = first.find((x) => x.event === id);
    const competes = !!p.registration?.isCompeting && p.registration.eventIds.includes(id);
    const tasks = Object.entries(r?.tasks ?? {}) as [Task, number[]][];
    if (!competes && r?.group == null && !tasks.length) continue;
    const group = r?.group != null ? String(r.group) : competes ? '' : '–';
    const task = tasks.map(([t, groups]) => `${TASK_LETTER[t]} ${[...groups].sort((a, b) => a - b).join(',')}`).join(' ');
    rows.push([id, group, task || '–']);
  }
  return rows;
}

// flag: an image URI for the country's flag; the designs draw Türkiye's and Italy's themselves.
export function badgePerson(p: Person, w: Wcif, activities: Map<number, ActivityInfo>, lang: BadgeLang, flag = ''): BadgePerson {
  const role = roleOf(p);
  return {
    name: p.name,
    wcaId: p.wcaId ?? '',
    id: p.registrantId == null ? '' : String(p.registrantId),
    country: p.countryIso2,
    countryName: countryName(p.countryIso2, lang === 'en' ? 'en' : 'tr'),
    flag,
    // The designs have no trainee band; trainee delegates wear the delegate's.
    role: role === 'trainee-delegate' ? 'delegate' : role,
    rows: badgeRows(p, w, activities),
  };
}

// Badge A reads the date as d1, badge B as date.
export function badgeComp(w: Wcif, lang: BadgeLang) {
  const d = dateRange(w.schedule.startDate, w.schedule.numberOfDays, lang === 'en' ? 'en' : 'tr');
  return { name: w.name, d1: d, date: d };
}

// '14 NOV', '14 - 15 NOV', '31 OCT - 1 NOV'; in Turkish with full month names, '31 EKİM - 1 KASIM'. No year: the
// competition name carries it.
export function dateRange(start: string, days: number, locale: 'en' | 'tr'): string {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(first.getTime() + (Math.max(days, 1) - 1) * 86_400_000);
  const fmt = new Intl.DateTimeFormat(locale, { month: locale === 'en' ? 'short' : 'long', timeZone: 'UTC' });
  const month = (d: Date) => fmt.format(d).toLocaleUpperCase(locale);
  const a = first.getUTCDate();
  const b = last.getUTCDate();
  if (days <= 1) return `${a} ${month(first)}`;
  return month(first) === month(last) ? `${a} - ${b} ${month(last)}` : `${a} ${month(first)} - ${b} ${month(last)}`;
}

// A4 sheet for badges of w × h mm printed as back-and-front pairs (2w × h): the orientation that holds more pairs,
// portrait on a tie.
export function sheetGrid(w: number, h: number) {
  const fit = (pw: number, ph: number) => ({ pw, ph, cols: Math.floor(pw / (2 * w) + 1e-6), rows: Math.floor(ph / h + 1e-6) });
  const portrait = fit(210, 297);
  const landscape = fit(297, 210);
  return portrait.cols * portrait.rows >= landscape.cols * landscape.rows ? portrait : landscape;
}

// The back face's QR: the competition's live results. WCA Live's link works once the delegate has imported the
// competition; the WCA site's own live results need no import. Other software gets the competition page.
export function liveUrl(id: string, scoretaking: string | null): string {
  if (scoretaking === 'wca_live') return `https://live.worldcubeassociation.org/link/competitions/${id}`;
  if (scoretaking === 'internal') return `https://worldcubeassociation.org/competitions/${id}/live`;
  return `https://worldcubeassociation.org/competitions/${id}`;
}
