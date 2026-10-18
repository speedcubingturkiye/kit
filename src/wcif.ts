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
export type Room = { id: number; name: string; color: string; activities: Activity[] };
export type Venue = { id: number; name: string; timezone: string; rooms: Room[] };
export type Wcif = {
  formatVersion: string;
  id: string;
  name: string;
  shortName?: string;
  persons: Person[];
  events: { id: string }[];
  schedule: { startDate: string; numberOfDays: number; venues: Venue[] };
};

export type ActivityInfo = { parentCode: string; code: string; start: string; end: string; timezone: string; room: string };
export type Role = 'delegate' | 'trainee-delegate' | 'organizer' | 'staff' | 'competitor';
export type Task = 'judge' | 'scrambler' | 'runner' | 'dataentry' | 'announcer' | 'other';
export type ScheduleRow = {
  day: string;
  parentCode: string;
  event: string;
  round: number | null;
  start: string;
  end: string;
  timezone: string;
  room: string;
  group: number | null;
  station: number | null;
  tasks: Partial<Record<Task, number[]>>;
};

const WCA_API = 'https://www.worldcubeassociation.org/api/v0';

// The public WCIF needs no login. A 404 means a wrong ID; other failures are reported with their status.
export async function fetchPublicWcif(id: string): Promise<Wcif> {
  const res = await fetch(`${WCA_API}/competitions/${encodeURIComponent(id.trim())}/wcif/public`);
  if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : `http-${res.status}`);
  return parseWcif(await res.text());
}

export function parseWcif(text: string): Wcif {
  const w = JSON.parse(text) as Wcif;
  if (!w || !Array.isArray(w.persons) || !w.schedule || !Array.isArray(w.schedule.venues)) throw new Error('not-wcif');
  return minimise(w);
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

// Every activity and child activity by id, with its round's times, venue time zone and room.
export function indexActivities(w: Wcif): Map<number, ActivityInfo> {
  const map = new Map<number, ActivityInfo>();
  for (const venue of w.schedule.venues) {
    for (const room of venue.rooms) {
      for (const a of room.activities) {
        const base = { parentCode: a.activityCode, start: a.startTime, end: a.endTime, timezone: venue.timezone, room: room.name };
        map.set(a.id, { ...base, code: a.activityCode });
        for (const c of a.childActivities ?? []) map.set(c.id, { ...base, code: c.activityCode });
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

const TASKS: Record<string, Task> = {
  'staff-judge': 'judge',
  'staff-scrambler': 'scrambler',
  'staff-runner': 'runner',
  'staff-dataentry': 'dataentry',
  'staff-announcer': 'announcer',
};

export function dayOf(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

// One row per round the person competes or works in: their group and station, and the groups of each task.
export function scheduleOf(p: Person, activities: Map<number, ActivityInfo>): ScheduleRow[] {
  const rows = new Map<string, ScheduleRow>();
  for (const a of p.assignments ?? []) {
    const act = activities.get(a.activityId);
    if (!act) continue;
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
        group: null,
        station: null,
        tasks: {},
      };
      rows.set(act.parentCode, row);
    }
    const g = group?.startsWith('g') ? Number(group.slice(1)) : null;
    if (a.assignmentCode === 'competitor') {
      row.group = g;
      row.station = a.stationNumber;
    } else if (g !== null) {
      const list = (row.tasks[TASKS[a.assignmentCode] ?? 'other'] ??= []);
      if (!list.includes(g)) list.push(g);
    }
  }
  return [...rows.values()].sort((x, y) => x.start.localeCompare(y.start));
}
