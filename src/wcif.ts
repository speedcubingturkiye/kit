// WCIF loading and the person and schedule logic the printed documents need.
// Adapted from Badgifier (MIT, © 2025 Dallas McNeil): getActivities in js/main.js, and the person filter,
// role order and personal schedule in js/generators.js.

export type Assignment = { activityId: number; assignmentCode: string; stationNumber: number | null };
export type Registration = { eventIds: string[]; status: string; isCompeting: boolean };
export type Person = {
  registrantId: number | null;
  name: string;
  wcaUserId: number;
  wcaId: string | null;
  countryIso2: string;
  roles?: string[];
  registration: Registration | null;
  assignments?: Assignment[];
  birthdate?: string;
  email?: string;
};
export type Activity = { id: number; activityCode: string; startTime: string; endTime: string; childActivities?: Activity[] };
// Round results as the WCIF carries them while the competition runs: only entered attempts are listed, and a result
// without attempts (ranking null) is a competitor who has not competed in the round yet.
export type Result = { personId: number; ranking: number | null; attempts: { value: number }[]; best: number; average: number };
export type Round = { id: string; format: string; cutoff?: { numberOfAttempts: number; resultValue: number } | null; results?: Result[] };
export type Room = { id: number; name: string; color: string; activities: Activity[] };
export type Venue = { id: number; name: string; timezone: string; rooms: Room[] };
export type Wcif = {
  formatVersion: string;
  id: string;
  name: string;
  shortName?: string;
  persons: Person[];
  events: { id: string; rounds?: Round[] }[];
  schedule: { startDate: string; numberOfDays: number; venues: Venue[] };
};

// start and end are the round's; own and ownEnd are the activity's own (a group's, for a group).
export type ActivityInfo = { parentCode: string; code: string; start: string; end: string; own: string; ownEnd: string; timezone: string; room: string; roomColor: string };
export type Role = 'delegate' | 'trainee-delegate' | 'organizer' | 'staff' | 'competitor';
export type Task =
  | 'judge' | 'scrambler' | 'runner' | 'delegate' | 'dataentry' | 'announcer' | 'stagelead'
  | 'showrunner' | 'stream' | 'photo' | 'setupteardown' | 'core' | 'other';
export type ScheduleRow = {
  day: string;
  parentCode: string;
  event: string;
  round: number | null;
  start: string;
  end: string;
  timezone: string;
  // The room of the person's competing group (else of their first assignment), and the earliest start and latest end
  // of their own groups in the round.
  room: string;
  roomColor: string;
  first: string;
  last: string;
  group: number | null;
  station: number | null;
  tasks: Partial<Record<Task, number[]>>;
};

export const WCA_API = 'https://www.worldcubeassociation.org/api/v0';

// The public WCIF, version 2, needs no login. A 404 means a wrong ID; other failures are reported with their status.
export async function fetchPublicWcif(id: string): Promise<Wcif> {
  const res = await fetch(`${WCA_API}/competitions/${encodeURIComponent(id.trim())}/wcif/version/2`);
  if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : `http-${res.status}`);
  return parseWcif(await res.text());
}

// What the WCIF lacks: the scoretaking software ('wca_live', 'internal' or 'external'), the city, for the
// certificates, and whether the results are posted. Null, '' and false when they cannot be read.
export type CompetitionInfo = { scoretaking: string | null; city: string; resultsPosted: boolean };
export async function fetchCompetitionInfo(id: string): Promise<CompetitionInfo> {
  try {
    const res = await fetch(`${WCA_API}/competitions/${encodeURIComponent(id.trim())}`);
    if (!res.ok) return { scoretaking: null, city: '', resultsPosted: false };
    const c = (await res.json()) as { scoretaking_software?: string; city?: string; results_posted_at?: string | null };
    return { scoretaking: c.scoretaking_software ?? null, city: c.city ?? '', resultsPosted: !!c.results_posted_at };
  } catch {
    return { scoretaking: null, city: '', resultsPosted: false };
  }
}

export function parseWcif(text: string): Wcif {
  const w = JSON.parse(text) as Wcif;
  if (!w || !Array.isArray(w.persons) || !w.schedule || !Array.isArray(w.schedule.venues)) throw new Error('not-wcif');
  fromV1(w);
  return minimise(w);
}

// A file saved from WCIF version 1 names an attempt's value `result` and the cutoff's `attemptResult`; version 2
// calls them `value` and `resultValue`.
function fromV1(w: Wcif) {
  for (const e of w.events ?? []) {
    for (const r of e.rounds ?? []) {
      const c = r.cutoff as { resultValue?: number; attemptResult?: number } | null | undefined;
      if (c && c.resultValue === undefined) c.resultValue = c.attemptResult;
      for (const x of r.results ?? []) {
        for (const a of x.attempts as { value?: number; result?: number }[]) if (a.value === undefined) a.value = a.result;
      }
    }
  }
}

// Only what the documents need stays in memory: a private WCIF's birth dates, e-mails, guests and notes are dropped
// on load (KVKK data minimisation).
export function minimise(w: Wcif): Wcif {
  for (const p of w.persons) {
    delete p.birthdate;
    delete p.email;
    if (p.registration) {
      const r = p.registration as Registration & Record<string, unknown>;
      delete r.guests;
      delete r.comments;
      delete r.administrativeNotes;
    }
  }
  return w;
}

// Every activity and child activity by id, with its round's times, its own start, venue time zone and room.
export function indexActivities(w: Wcif): Map<number, ActivityInfo> {
  const map = new Map<number, ActivityInfo>();
  for (const venue of w.schedule.venues) {
    for (const room of venue.rooms) {
      for (const a of room.activities) {
        const base = { parentCode: a.activityCode, start: a.startTime, end: a.endTime, timezone: venue.timezone, room: room.name, roomColor: room.color };
        map.set(a.id, { ...base, code: a.activityCode, own: a.startTime, ownEnd: a.endTime });
        for (const c of a.childActivities ?? []) map.set(c.id, { ...base, code: c.activityCode, own: c.startTime, ownEnd: c.endTime });
      }
    }
  }
  return map;
}

export function roleOf(p: Person): Role {
  const roles = p.roles ?? [];
  if (roles.includes('delegate')) return 'delegate';
  if (roles.includes('trainee-delegate')) return 'trainee-delegate';
  if (roles.includes('organizer')) return 'organizer';
  if (!p.registration?.isCompeting) return 'staff';
  return 'competitor';
}

// Badges go to accepted registrations and to delegates and organisers without one. Sorted by name in Turkish order;
// unregistered staff come last, and newcomers can be put first.
export function badgePeople(w: Wcif, newcomersFirst = false): Person[] {
  const people = w.persons.filter((p) =>
    p.registration ? p.registration.status === 'accepted' : (p.roles ?? []).some((r) => r === 'organizer' || r === 'delegate'));
  const rank = (p: Person) => (!p.registration ? 2 : newcomersFirst && p.wcaId ? 1 : 0);
  return people.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'tr'));
}

// The WCIF's own staff codes and those other tools write (the set Competition Groups shows). Breaks and lunch are not
// tasks; any other staff code is 'other'.
const TASKS: Record<string, Task | null> = {
  'staff-judge': 'judge',
  'staff-scrambler': 'scrambler',
  'staff-runner': 'runner',
  'staff-delegate': 'delegate',
  'staff-dataentry': 'dataentry',
  'staff-announcer': 'announcer',
  'staff-stagelead': 'stagelead',
  'staff-showrunner': 'showrunner',
  'staff-stream': 'stream',
  'staff-photo': 'photo',
  'staff-setupteardown': 'setupteardown',
  'staff-core': 'core',
  'staff-other': 'other',
  'staff-break': null,
  'staff-lunch': null,
};

export function dayOf(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

// One row per round the person competes or works in: their group and station, and the groups of each task.
export function scheduleOf(p: Person, activities: Map<number, ActivityInfo>): ScheduleRow[] {
  const rows = new Map<string, ScheduleRow>();
  for (const a of p.assignments ?? []) {
    const act = activities.get(a.activityId);
    if (!act || TASKS[a.assignmentCode] === null) continue;
    const [event, round, group] = act.code.split('-');
    let row = rows.get(act.parentCode);
    if (!row) {
      row = {
        day: dayOf(act.start, act.timezone),
        parentCode: act.parentCode,
        event,
        round: round?.startsWith('r') ? Number(round.slice(1)) : null,
        start: act.start,
        end: act.end,
        timezone: act.timezone,
        room: act.room,
        roomColor: act.roomColor,
        first: act.own,
        last: act.ownEnd,
        group: null,
        station: null,
        tasks: {},
      };
      rows.set(act.parentCode, row);
    }
    if (act.own < row.first) row.first = act.own;
    if (act.ownEnd > row.last) row.last = act.ownEnd;
    const g = group?.startsWith('g') ? Number(group.slice(1)) : null;
    if (a.assignmentCode === 'competitor') {
      row.group = g;
      row.station = a.stationNumber;
      row.room = act.room;
      row.roomColor = act.roomColor;
    } else if (g !== null) {
      const list = (row.tasks[TASKS[a.assignmentCode] ?? 'other'] ??= []);
      if (!list.includes(g)) list.push(g);
    }
  }
  return [...rows.values()].sort((x, y) => x.start.localeCompare(y.start));
}
