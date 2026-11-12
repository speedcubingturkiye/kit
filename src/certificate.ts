// Certificate data from the podiums and the WCIF, in the shape the certificate design takes as props.cert. The
// certificates are in English.

import { dateRange } from './badge.ts';
import { EVENTS, countryName } from './i18n.ts';
import { decidingResult, formatResult, type Podium } from './podium.ts';
import type { Wcif } from './wcif.ts';

// A signature line: the name, the role in English, and in Turkish when it is not one the design knows.
export type Sign = [name: string, role: string, roleTr?: string];
export type CertComp = { name: string; date: string; dateShort: string; day: string; city: string };
export type Cert = {
  name: string;
  wcaId: string;
  country: string;
  countryName: string;
  flag: string;
  place: string;
  event: string;
  eventName: string;
  icon: string;
  kind: 'avg' | 'mean' | 'single';
  result: string;
  comp: CertComp;
  signs: Sign[];
  // A participation certificate: no place, event or result, but the events the person took part in.
  part?: boolean;
  events?: { id: string; name: string; icon: string }[];
  // A blank certificate, to fill in by hand: no name, and no events (participation) or result (podium).
  blank?: boolean;
};

// The dates as the certificates write them: '31 OCTOBER - 1 NOVEMBER 2026', without the year next to the city, and
// the last day for a dated signature line, '1 November 2026'. The city comes from the WCA API ('' if unknown).
export function certComp(w: Wcif, city: string): CertComp {
  const { startDate, numberOfDays } = w.schedule;
  const dateShort = dateRange(startDate, numberOfDays, 'en', 'long');
  const last = new Date(Date.parse(`${startDate}T00:00:00Z`) + (Math.max(numberOfDays, 1) - 1) * 86_400_000);
  return {
    name: w.name,
    date: `${dateShort} ${last.getUTCFullYear()}`,
    dateShort,
    day: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(last),
    city: city.toLocaleUpperCase('en'),
  };
}

const latinName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');

// Who can sign: the competition's WCA delegates and organisers, by name in Turkish order. Trainee delegates do not
// sign as the WCA Delegate.
export function signers(w: Wcif) {
  const named = (role: string) => w.persons.filter((p) => p.roles?.includes(role)).map((p) => latinName(p.name)).sort((a, b) => a.localeCompare(b, 'tr'));
  return { delegates: named('delegate'), organizers: named('organizer') };
}

// One certificate per place of each finished final, in the competition's event order; tied places each get one.
// flagOf and iconOf give image URIs ('' when there is none).
export function certificates(
  podiums: Podium[], comp: CertComp, signs: Sign[], flagOf: (iso2: string) => string, iconOf: (event: string) => string,
): Cert[] {
  return podiums.filter((p) => p.state === 'done').flatMap((p) => p.places.map((x): Cert => {
    const { value, kind } = decidingResult(p.format, x);
    return {
      name: x.name,
      wcaId: x.wcaId ?? '',
      country: x.country,
      countryName: countryName(x.country, 'en'),
      flag: flagOf(x.country),
      place: String(x.place),
      event: p.event,
      eventName: EVENTS[p.event]?.[2] ?? p.event,
      icon: iconOf(p.event),
      kind: kind === 'average' ? 'avg' : kind,
      result: formatResult(value, p.event, kind !== 'single'),
      comp,
      signs,
    };
  }));
}

// A blank participation certificate, for someone not in the WCIF (a walk-in, say), to write the name on by hand.
export function blankParticipation(comp: CertComp, signs: Sign[]): Cert {
  return { name: '', wcaId: '', country: '', countryName: '', flag: '', place: '', event: '', eventName: '', icon: '', kind: 'single', result: '',
    comp, signs, part: true, events: [], blank: true };
}

// Blank podium certificates, to write the name on by hand: n of each place, first to third, for each event given (in
// the competition's order), with the event and its final's kind of result but no result.
export function blankPodiums(w: Wcif, events: string[], n: number, comp: CertComp, signs: Sign[], iconOf: (event: string) => string): Cert[] {
  return w.events.filter((e) => events.includes(e.id)).flatMap((e) => {
    const format = e.rounds?.at(-1)?.format ?? 'a';
    const kind = format === 'a' ? 'avg' : format === 'm' ? 'mean' : 'single';
    return ['1', '2', '3'].flatMap((place) => Array.from({ length: n }, (): Cert => ({
      name: '', wcaId: '', country: '', countryName: '', flag: '', place, event: e.id, eventName: EVENTS[e.id]?.[2] ?? e.id,
      icon: iconOf(e.id), kind, result: '', comp, signs, blank: true,
    })));
  });
}

// Participation certificates: one for each accepted competitor, by name in Turkish order, with their events in the
// competition's order. Once the WCIF has results, only those who competed (a solve or a DNF) get one, with the events
// they competed in; before that, everyone with the events they registered for.
export function participations(
  w: Wcif, comp: CertComp, signs: Sign[], flagOf: (iso2: string) => string, iconOf: (event: string) => string,
): Cert[] {
  const competed = new Map<number, Set<string>>();
  for (const e of w.events) {
    for (const r of e.rounds ?? []) {
      for (const x of r.results ?? []) {
        if (x.attempts.some((a) => a.value > 0 || a.value === -1)) competed.set(x.personId, (competed.get(x.personId) ?? new Set()).add(e.id));
      }
    }
  }
  return w.persons
    .filter((p) => p.registration?.status === 'accepted' && p.registration.isCompeting && (!competed.size || competed.has(p.registrantId ?? -1)))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map((p): Cert => {
      const mine = competed.get(p.registrantId ?? -1) ?? new Set(p.registration?.eventIds);
      return {
        name: p.name,
        wcaId: p.wcaId ?? '',
        country: p.countryIso2,
        countryName: countryName(p.countryIso2, 'en'),
        flag: flagOf(p.countryIso2),
        place: '',
        event: '',
        eventName: '',
        icon: '',
        kind: 'single',
        result: '',
        comp,
        signs,
        part: true,
        events: w.events.filter((e) => mine.has(e.id)).map((e) => ({ id: e.id, name: EVENTS[e.id]?.[2] ?? e.id, icon: iconOf(e.id) })),
      };
    });
}
