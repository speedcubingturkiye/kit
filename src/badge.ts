// Badge data from the WCIF, in the shape the badge designs take as props (person, comp, qr).

import { TASK_LETTER, TEXT, countryName } from './i18n.ts';
import { dayOf, roleOf, scheduleOf, type ActivityInfo, type Person, type Task, type Wcif } from './wcif.ts';

export type BadgeLang = 'en' | 'tr-en';
export type BadgeRow = [event: string, group: string, task: string, time: string, day: string, stage: string, stageColor: string, station: string];
export type BadgePerson = {
  name: string;
  localName: string;
  wcaId: string;
  id: string;
  country: string;
  countryName: string;
  flag: string;
  role: string;
  rows: BadgeRow[];
  legend: [letter: string, tr: string, en: string][];
};

const clockOf = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

// Whether the competition's schedule uses more than one stage (room).
export function multiStage(w: Wcif): boolean {
  return new Set(w.schedule.venues.flatMap((v) => v.rooms.filter((r) => r.activities.length).map((r) => r.name))).size > 1;
}

// As Badgifier's options, all off by default: times, stages and stations on the back, events the person only works
// in left off, and the local name on the front.
export type BadgeOptions = { times?: boolean; stages?: boolean; stations?: boolean; hideStaffOnly?: boolean; localNames?: boolean };

// One row per event from the first round, in the competition's event order (the front's icons follow it; the back
// sorts its rows by time itself): the group ('' until groups are assigned, '–' in an event the person does not compete
// in) and the tasks ('J 1,3' or '–'). With times, also when: the start of the person's earliest group in the round, or
// the round's start before groups are assigned, as 'HH:MM' with its day in the venue's time zone. With stages, and when
// the competition uses more than one, where: the stage (room) and its colour. With stations, the competing station
// ('' when the WCIF has none).
export function badgeRows(
  p: Person, w: Wcif, activities: Map<number, ActivityInfo>,
  { times = false, stages = false, stations = false, hideStaffOnly = false }: BadgeOptions = {},
): BadgeRow[] {
  const first = scheduleOf(p, activities).filter((r) => r.round === 1);
  const showStages = stages && multiStage(w);
  const roundOnes = new Map<string, ActivityInfo[]>();
  for (const a of activities.values()) {
    if (a.code !== a.parentCode || !a.code.endsWith('-r1')) continue;
    const e = a.code.split('-')[0];
    roundOnes.set(e, [...(roundOnes.get(e) ?? []), a]);
  }
  const rows: BadgeRow[] = [];
  for (const { id } of w.events) {
    const r = first.find((x) => x.event === id);
    const competes = !!p.registration?.isCompeting && p.registration.eventIds.includes(id);
    const tasks = Object.entries(r?.tasks ?? {}) as [Task, number[]][];
    if (!competes && r?.group == null && !tasks.length) continue;
    if (hideStaffOnly && !competes && r?.group == null) continue;
    const group = r?.group != null ? String(r.group) : competes ? '' : '–';
    const task = tasks.map(([t, groups]) => `${TASK_LETTER[t]} ${[...groups].sort((a, b) => a - b).join(',')}`).join(' ');
    let at = r ? { iso: r.first, tz: r.timezone, room: r.room, color: r.roomColor } : null;
    const round = roundOnes.get(id) ?? [];
    if (!at && round.length) {
      const a = round.reduce((x, y) => (y.start < x.start ? y : x));
      // Before groups are assigned, a round held on several stages at once has no stage yet.
      const one = new Set(round.map((x) => x.room)).size === 1;
      at = { iso: a.start, tz: a.timezone, room: one ? a.room : '', color: one ? a.roomColor : '' };
    }
    const when = times ? at : null;
    const where = showStages ? at : null;
    rows.push([id, group, task || '–', when ? clockOf(when.iso, when.tz) : '', when ? dayOf(when.iso, when.tz) : '',
      where ? where.room : '', where ? where.color : '', stations && r?.station != null ? String(r.station) : '']);
  }
  return rows;
}

// The task letters on a badge besides J, S and R, which every badge legend explains, as [letter, Turkish, English]
// in the letters' fixed order.
export function badgeLegend(rows: BadgeRow[]): [string, string, string][] {
  const used = new Set(rows.flatMap((r) => r[2].split(' ').filter((x) => /^[A-Z]$/.test(x))));
  return (Object.keys(TASK_LETTER) as Task[])
    .filter((t) => t !== 'judge' && t !== 'scrambler' && t !== 'runner' && used.has(TASK_LETTER[t]))
    .map((t) => [TASK_LETTER[t], TEXT.tr.tasks[t], TEXT.en.tasks[t]]);
}

// flag: an image URI for the country's flag; the designs draw Türkiye's and Italy's themselves.
export function badgePerson(p: Person, w: Wcif, activities: Map<number, ActivityInfo>, lang: BadgeLang, flag = '', options: BadgeOptions = {}): BadgePerson {
  const role = roleOf(p);
  const rows = badgeRows(p, w, activities, options);
  return {
    name: p.name,
    // The WCIF gives a local name in brackets after the name, e.g. 'Parsa Askari Rad (پارسا عسکری راد)'.
    localName: options.localNames ? (/\(([^)]*)\)\s*$/.exec(p.name)?.[1].trim() ?? '') : '',
    wcaId: p.wcaId ?? '',
    id: p.registrantId == null ? '' : String(p.registrantId),
    country: p.countryIso2,
    countryName: countryName(p.countryIso2, lang === 'en' ? 'en' : 'tr'),
    flag,
    // The designs have no trainee band; trainee delegates wear the delegate's.
    role: role === 'trainee-delegate' ? 'delegate' : role,
    rows,
    legend: badgeLegend(rows),
  };
}

// Badge A reads the date as d1, badge B as date.
export function badgeComp(w: Wcif, lang: BadgeLang) {
  const d = dateRange(w.schedule.startDate, w.schedule.numberOfDays, lang === 'en' ? 'en' : 'tr');
  return { name: w.name, d1: d, date: d };
}

// '14 NOV', '14 - 15 NOV', '31 OCT - 1 NOV'; in Turkish with full month names, '31 EKİM - 1 KASIM'. No year: the
// competition name carries it. The certificates spell English months in full too ('31 OCTOBER - 1 NOVEMBER').
export function dateRange(start: string, days: number, locale: 'en' | 'tr', months: 'short' | 'long' = locale === 'en' ? 'short' : 'long'): string {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(first.getTime() + (Math.max(days, 1) - 1) * 86_400_000);
  const fmt = new Intl.DateTimeFormat(locale, { month: months, timeZone: 'UTC' });
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
