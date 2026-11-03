// Run with `npm test`. Fictional people and finals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { certComp, certificates, participations, signers } from './certificate.ts';
import type { Podium } from './podium.ts';
import type { Wcif } from './wcif.ts';

const person = (registrantId: number, name: string, roles: string[] = []) =>
  ({ registrantId, name, wcaUserId: registrantId, wcaId: null, countryIso2: 'TR', roles, registration: null });
const wcif = (startDate: string, numberOfDays: number) => ({
  formatVersion: '1.1', id: 'Test2027', name: 'Test 2027', events: [], schedule: { startDate, numberOfDays, venues: [] },
  persons: [
    person(1, 'Selim Er', ['organizer']), person(2, 'Ada Su (Ада Су)', ['delegate']), person(3, 'Bora Ay', ['organizer', 'delegate']),
    person(4, 'Cem Ok', ['trainee-delegate']), person(5, 'Ece Ün'),
  ],
}) as unknown as Wcif;

test('competition dates and city as the certificates write them', () => {
  assert.deepEqual(certComp(wcif('2026-10-31', 2), 'Istanbul'),
    { name: 'Test 2027', date: '31 OCTOBER - 1 NOVEMBER 2026', dateShort: '31 OCTOBER - 1 NOVEMBER', day: '1 November 2026', city: 'ISTANBUL' });
  const one = certComp(wcif('2026-11-14', 1), '');
  assert.equal(one.date, '14 NOVEMBER 2026');
  assert.equal(one.day, '14 November 2026');
  assert.equal(one.city, '');
});

test('signers: delegates and organisers by name, local names dropped, trainees left out', () => {
  assert.deepEqual(signers(wcif('2026-10-31', 2)), { delegates: ['Ada Su', 'Bora Ay'], organizers: ['Bora Ay', 'Selim Er'] });
});

test('certificates: finished finals only, every place including ties, the deciding result', () => {
  const place = (p: number, name: string, best: number, average: number) => ({ place: p, name, wcaId: p === 1 ? '2017ERAD01' : null, country: p === 3 ? 'GR' : 'TR', registrantId: p, best, average });
  const podiums: Podium[] = [
    { event: '333', round: 2, format: 'a', state: 'done', places: [place(1, 'Ada Er', 690, 705), place(2, 'Bora Su', 790, 805), place(2, 'Cem Ay', 791, 805)] },
    { event: '333bf', round: 1, format: '3', state: 'done', places: [place(1, 'Ada Er', 3000, -1)] },
    { event: '666', round: 1, format: 'm', state: 'done', places: [place(3, 'Deniz Ok', 7000, 7212)] },
    { event: 'pyram', round: 1, format: 'a', state: 'running', places: [] },
  ];
  const comp = certComp(wcif('2026-10-31', 2), 'Istanbul');
  const signs: [string, string][] = [['Ada Su', 'WCA DELEGATE'], ['Selim Er', 'ORGANIZER']];
  const list = certificates(podiums, comp, signs, (c) => `flag:${c}`, (e) => (e === '666' ? 'icon:666' : ''));
  assert.deepEqual(list.map((c) => [c.event, c.place, c.name, c.kind, c.result]), [
    ['333', '1', 'Ada Er', 'avg', '7.05'],
    ['333', '2', 'Bora Su', 'avg', '8.05'],
    ['333', '2', 'Cem Ay', 'avg', '8.05'],
    ['333bf', '1', 'Ada Er', 'single', '30.00'],
    ['666', '3', 'Deniz Ok', 'mean', '1:12.12'],
  ]);
  const c = list[4];
  assert.equal(c.eventName, '6x6x6 Cube');
  assert.equal(c.icon, 'icon:666');
  assert.equal(c.flag, 'flag:GR');
  assert.equal(c.countryName, 'Greece');
  assert.equal(c.wcaId, '');
  assert.equal(list[0].wcaId, '2017ERAD01');
  assert.equal(list[0].comp, comp);
  assert.equal(list[0].signs, signs);
});

test('participation: accepted competitors by name with their events; once there are results, those who competed', () => {
  const reg = (eventIds: string[], status = 'accepted', isCompeting = true) => ({ eventIds, status, isCompeting });
  const w = {
    formatVersion: '1.1', id: 'Test2027', name: 'Test 2027', schedule: { startDate: '2026-10-31', numberOfDays: 1, venues: [] },
    events: [{ id: '333', rounds: [{ id: '333-r1', format: 'a', results: [] }] }, { id: 'pyram', rounds: [] }, { id: '666', rounds: [] }],
    persons: [
      { ...person(1, 'Zeynep Ak'), registration: reg(['pyram', '333']) },
      { ...person(2, 'Ömer Su'), countryIso2: 'GR', registration: reg(['666']) },
      { ...person(3, 'Can Ay'), registration: reg(['333'], 'pending') },
      { ...person(4, 'Ece Ün'), registration: reg([], 'accepted', false) },
      person(5, 'Ada Er', ['organizer']),
    ],
  } as unknown as Wcif;
  const comp = certComp(w, 'Istanbul');
  const signs: [string, string][] = [['Ada Er', 'ORGANIZER']];
  const list = participations(w, comp, signs, (c) => `flag:${c}`, (e) => `icon:${e}`);
  assert.deepEqual(list.map((c) => [c.name, c.events?.map((e) => e.id)]), [['Ömer Su', ['666']], ['Zeynep Ak', ['333', 'pyram']]]);
  assert.deepEqual(list[0].events, [{ id: '666', name: '6x6x6 Cube', icon: 'icon:666' }]);
  assert.equal(list[0].part, true);
  assert.equal(list[0].flag, 'flag:GR');
  assert.equal(list[0].place, '');
  // With results only those who competed: a DNF counts, a DNS alone does not.
  const r1 = (w.events[0].rounds ?? [])[0];
  r1.results = [
    { personId: 2, ranking: 1, attempts: [{ value: -1 }], best: -1, average: -1 },
    { personId: 1, ranking: null, attempts: [{ value: -2 }], best: -2, average: -2 },
  ];
  assert.deepEqual(participations(w, comp, signs, () => '', () => '').map((c) => [c.name, c.events?.map((e) => e.id)]), [['Ömer Su', ['333']]]);
});
