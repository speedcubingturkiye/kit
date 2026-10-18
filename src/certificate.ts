// Certificate data from the podiums and the WCIF, in the shape the certificate design takes as props.cert. The
// certificates are in English.

import { dateRange } from './badge.ts';
import { EVENTS, countryName } from './i18n.ts';
import { decidingResult, formatResult, type Podium } from './podium.ts';
import type { Wcif } from './wcif.ts';

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
  signs: [name: string, role: string][];
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
  podiums: Podium[], comp: CertComp, signs: [string, string][], flagOf: (iso2: string) => string, iconOf: (event: string) => string,
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
