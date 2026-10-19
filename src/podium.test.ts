// Run with `npm test`. Fictional finals cover ties, DNFs, cutoffs, rounds still running and WCA Live's shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complete, decidingResult, formatResult, podiumFromLive, podiumsFromResults, podiumsFromWcif, type LivePodium } from './podium.ts';
import type { Result, Wcif } from './wcif.ts';

const res = (personId: number, ranking: number | null, attempts: number[], best: number, average: number): Result =>
  ({ personId, ranking, attempts: attempts.map((value) => ({ value })), best, average });
const person = (registrantId: number, name: string, countryIso2 = 'TR') =>
  ({ registrantId, name, wcaUserId: registrantId, wcaId: null, countryIso2, registration: null });
const w = {
  formatVersion: '2.2', id: 'Test2027', name: 'Test 2027', schedule: { startDate: '2027-03-06', numberOfDays: 1, venues: [] },
  persons: [person(1, 'Ada Er'), person(2, 'Bora Su'), person(3, 'Cem Ay', 'GR'), person(4, 'Deniz Ok'), person(5, 'Ece Ün')],
  events: [
    { id: '333', rounds: [{ id: '333-r1', format: 'a', results: [] }, { id: '333-r2', format: 'a', results: [
      res(1, 1, [700, 710, 690, 720, 705], 690, 705),
      res(2, 2, [800, 810, 790, 820, 805], 790, 805),
      res(3, 2, [800, 810, 790, 820, 805], 790, 805),
      res(4, 4, [900, 910, 890, 920, 905], 890, 905),
      res(5, 5, [-1, -1, -1, -1, -1], -1, -1),
    ] }] },
    { id: 'pyram', rounds: [{ id: 'pyram-r1', format: 'a', results: [res(1, 1, [300, 310, 320, 330, 340], 300, 320), res(2, null, [], 0, 0)] }] },
    { id: '222', rounds: [{ id: '222-r1', format: 'a', results: [res(1, null, [], 0, 0)] }] },
    { id: '333bf', rounds: [{ id: '333bf-r1', format: '3', results: [res(1, 1, [3000, -1, 3500], 3000, -1), res(2, 2, [-1, -1, -1], -1, -1)] }] },
    { id: 'minx', rounds: [{ id: 'minx-r1', format: 'a', cutoff: { numberOfAttempts: 2, resultValue: 6000 }, results: [
      res(1, 1, [5000, 5100, 5200, 5300, 5400], 5000, 5200), res(2, 2, [6500, 6600], 6500, 0),
    ] }] },
  ],
} as unknown as Wcif;

test('complete: all attempts, or the cutoff attempts when none beat it; never for head-to-head', () => {
  const round = { id: 'minx-r1', format: 'a', cutoff: { numberOfAttempts: 2, resultValue: 6000 } };
  assert.equal(complete(res(1, 1, [6500, 6600], 6500, 0), round), true);
  assert.equal(complete(res(1, 1, [5500, 6600], 5500, 0), round), false);
  assert.equal(complete(res(1, 1, [5500, 6600, 5000, 5100, 5200], 5000, 5300), round), true);
  assert.equal(complete(res(1, 1, [700, 720, 690, 710, 705], 690, 705), { id: '333-r4', format: 'h' }), false);
});

test('WCIF podiums: final round only, ties share a place, DNF-only is left off, unfinished rounds have none', () => {
  const p = podiumsFromWcif(w);
  const by = Object.fromEntries(p.map((x) => [x.event, x]));
  assert.deepEqual(by['333'].places.map((x) => [x.place, x.name]), [[1, 'Ada Er'], [2, 'Bora Su'], [2, 'Cem Ay']]);
  assert.equal(by['333'].round, 2);
  assert.equal(by['333'].state, 'done');
  assert.equal(by.pyram.state, 'running');
  assert.deepEqual(by.pyram.places, []);
  assert.equal(by['222'].state, 'waiting');
  assert.deepEqual(by['333bf'].places.map((x) => x.name), ['Ada Er']);
  assert.deepEqual(by.minx.places.map((x) => x.name), ['Ada Er', 'Bora Su']);
});

test('WCA Live podiums: finished rounds give places', () => {
  const lp = (finished: boolean, entered: number): LivePodium => ({
    round: { number: 3, finished, numEnteredResults: entered, format: { id: 'm' }, competitionEvent: { event: { id: '666' } } },
    results: finished ? [{ ranking: 1, best: 8096, average: 8484, person: { name: 'Ada Er', wcaId: '2017ERAD01', registrantId: 1, country: { iso2: 'TR' } } }] : [],
  });
  assert.deepEqual(podiumFromLive(lp(true, 10)).places, [{ place: 1, name: 'Ada Er', wcaId: '2017ERAD01', country: 'TR', registrantId: 1, best: 8096, average: 8484 }]);
  assert.equal(podiumFromLive(lp(false, 4)).state, 'running');
  assert.equal(podiumFromLive(lp(false, 0)).state, 'waiting');
});

test('posted results: each event\'s final gives the places, ties share one, events without a posted final wait', () => {
  const r = (event_id: string, round_type_id: string, pos: number, name: string, best: number, average: number, format_id = 'a') =>
    ({ pos, best, average, name, country_iso2: 'TR', wca_id: null, event_id, round_type_id, format_id });
  const p = podiumsFromResults([
    r('333', '1', 1, 'Bora Su', 680, 700),
    r('333', 'f', 1, 'Ada Er', 690, 705), r('333', 'f', 2, 'Bora Su', 790, 805), r('333', 'f', 2, 'Cem Ay', 790, 805), r('333', 'f', 4, 'Deniz Ok', 890, 905),
    r('minx', 'c', 1, 'Ada Er', 5000, 5200), r('minx', 'c', 2, 'Bora Su', 6500, 0),
    r('333bf', 'f', 1, 'Ada Er', 3000, -1, '3'), r('333bf', 'f', 2, 'Bora Su', -1, -1, '3'),
  ], w);
  const by = Object.fromEntries(p.map((x) => [x.event, x]));
  assert.deepEqual(by['333'].places.map((x) => [x.place, x.name]), [[1, 'Ada Er'], [2, 'Bora Su'], [2, 'Cem Ay']]);
  assert.equal(by['333'].state, 'done');
  assert.equal(by['333'].round, 2);
  assert.deepEqual(by.minx.places.map((x) => x.place), [1, 2]);
  assert.deepEqual(by['333bf'].places.map((x) => x.name), ['Ada Er']);
  assert.equal(by['333bf'].format, '3');
  assert.equal(by['222'].state, 'waiting');
  assert.deepEqual(by['222'].places, []);
});

test('deciding result: average or mean, else the best single', () => {
  const place = { place: 1, name: '', wcaId: null, country: 'TR', registrantId: 1, best: 690, average: 705 };
  assert.deepEqual(decidingResult('a', place), { value: 705, kind: 'average' });
  assert.deepEqual(decidingResult('m', place), { value: 705, kind: 'mean' });
  assert.deepEqual(decidingResult('a', { ...place, average: -1 }), { value: 690, kind: 'single' });
  assert.deepEqual(decidingResult('3', place), { value: 690, kind: 'single' });
});

test('result formatting: times, DNF, Fewest Moves, Multi-Blind', () => {
  assert.equal(formatResult(625, '333'), '6.25');
  assert.equal(formatResult(6534, '333'), '1:05.34');
  assert.equal(formatResult(360000, '666'), '1:00:00.00');
  assert.equal(formatResult(-1, '333'), 'DNF');
  assert.equal(formatResult(-2, '333'), 'DNS');
  assert.equal(formatResult(24, '333fm'), '24');
  assert.equal(formatResult(2433, '333fm', true), '24.33');
  assert.equal(formatResult(910351102, '333mbf'), '10/12 58:31');
  assert.equal(formatResult(970360001, '333mbf'), '3/4 60:00');
});
