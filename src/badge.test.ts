// Run with `npm test`. A small fictional WCIF covers the badge rows, roles and dates; the QR is pinned to the code on
// the New Age Turkey 2026 test prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { badgeComp, badgeLegend, badgePerson, badgeRows, dateRange, groupList, liveUrl, sheetGrid, titleOf, titleParam } from './badge.ts';
import { EVENTS } from './i18n.ts';
import { ICONS } from './icons.ts';
import { qrPath } from './qr.ts';
import { indexActivities, parseWcif } from './wcif.ts';

const act = (id: number, code: string, start: string) => ({ id, activityCode: code, startTime: start, endTime: start });
const reg = (eventIds: string[], isCompeting = true) => ({ eventIds, status: 'accepted', isCompeting });
const as = (activityId: number, assignmentCode: string) => ({ activityId, assignmentCode, stationNumber: null });
const w = parseWcif(JSON.stringify({
  formatVersion: '1.1', id: 'Test2026', name: 'Test 2026', events: [{ id: '333' }, { id: 'pyram' }],
  schedule: {
    startDate: '2026-10-31', numberOfDays: 2,
    venues: [{ id: 1, name: 'V', timezone: 'Europe/Istanbul', rooms: [{ id: 1, name: 'Ana sahne', color: '#e30a17', activities: [
      { ...act(10, '333-r1', '2026-10-31T07:00:00Z'), childActivities: [act(11, '333-r1-g1', '2026-10-31T07:00:00Z'), act(12, '333-r1-g2', '2026-10-31T07:30:00Z')] },
      { ...act(20, '333-r2', '2026-11-01T07:00:00Z'), childActivities: [act(21, '333-r2-g1', '2026-11-01T07:00:00Z')] },
      { ...act(30, 'pyram-r1', '2026-10-31T09:00:00Z'), childActivities: [act(31, 'pyram-r1-g1', '2026-10-31T09:00:00Z')] },
    ] }] }],
  },
  persons: [
    { registrantId: 7, name: 'Zeynep Arslan', wcaUserId: 1, wcaId: '2019ARSL01', countryIso2: 'TR', roles: [], registration: reg(['333', 'pyram']),
      assignments: [as(12, 'competitor'), as(11, 'staff-judge'), as(31, 'staff-judge'), as(31, 'staff-scrambler'), as(21, 'staff-judge')] },
    { registrantId: 8, name: 'Elif Yıldız', wcaUserId: 2, wcaId: null, countryIso2: 'IQ', roles: [], registration: reg([], false),
      assignments: [as(12, 'staff-judge'), as(11, 'staff-judge')] },
    { registrantId: null, name: 'Ali Veli', wcaUserId: 3, wcaId: '2015VELI01', countryIso2: 'GB', roles: ['trainee-delegate'], registration: null },
  ],
}));
const acts = indexActivities(w);

test('rows: first-round group and tasks per event; blank group until assigned, dash where not competing', () => {
  // Zeynep also judges the 3x3 final (round 2 of 2), which gets a row of its own marked 'f'.
  assert.deepEqual(badgeRows(w.persons[0], w, acts), [
    ['333', '2', 'J 1', '', '', '', '', ''], ['333', '–', 'J 1', '', '', '', '', '', 'f'], ['pyram', '', 'J 1 S 1', '', '', '', '', '']]);
  assert.deepEqual(badgeRows(w.persons[1], w, acts), [['333', '–', 'J 1,2', '', '', '', '', '']]);
  assert.deepEqual(badgeRows(w.persons[2], w, acts), []);
  // With times: from the person's earliest own group in the round (judging group 1 before competing in group 2) to
  // the end of their latest; these groups have no length, so a group alone shows its start.
  assert.deepEqual(badgeRows(w.persons[0], w, acts, { times: true }), [
    ['333', '2', 'J 1', '10:00–10:30', '2026-10-31', '', '', ''], ['333', '–', 'J 1', '10:00', '2026-11-01', '', '', '', 'f'],
    ['pyram', '', 'J 1 S 1', '12:00', '2026-10-31', '', '', '']]);
});

test('later rounds and the person\'s own times: a row for each round they are in, from their first group to their last', () => {
  const g = (id: number, code: string, start: string, end: string) => ({ id, activityCode: code, startTime: start, endTime: end });
  const r3 = parseWcif(JSON.stringify({
    formatVersion: '1.1', id: 'Rounds2026', name: 'Rounds 2026', events: [{ id: '333' }],
    schedule: {
      startDate: '2026-10-31', numberOfDays: 1,
      venues: [{ id: 1, name: 'V', timezone: 'Europe/Istanbul', rooms: [{ id: 1, name: 'Ana sahne', color: '#e30a17', activities: [
        { ...g(10, '333-r1', '2026-10-31T07:00:00Z', '2026-10-31T07:40:00Z'),
          childActivities: [g(11, '333-r1-g1', '2026-10-31T07:00:00Z', '2026-10-31T07:20:00Z'), g(12, '333-r1-g2', '2026-10-31T07:20:00Z', '2026-10-31T07:40:00Z')] },
        { ...g(20, '333-r2', '2026-10-31T11:00:00Z', '2026-10-31T11:30:00Z'), childActivities: [g(21, '333-r2-g1', '2026-10-31T11:00:00Z', '2026-10-31T11:30:00Z')] },
        { ...g(30, '333-r3', '2026-10-31T13:00:00Z', '2026-10-31T13:30:00Z'), childActivities: [g(31, '333-r3-g1', '2026-10-31T13:00:00Z', '2026-10-31T13:30:00Z')] },
      ] }] }],
    },
    persons: [
      { registrantId: 1, name: 'Ada Su', wcaUserId: 1, wcaId: null, countryIso2: 'TR', roles: [], registration: reg(['333']),
        assignments: [as(12, 'competitor'), as(11, 'staff-judge'), as(21, 'staff-judge'), as(31, 'competitor')] },
      { registrantId: 2, name: 'Can Ay', wcaUserId: 2, wcaId: null, countryIso2: 'TR', roles: [], registration: reg(['333']), assignments: [] },
    ],
  }));
  const acts3 = indexActivities(r3);
  assert.deepEqual(badgeRows(r3.persons[0], r3, acts3, { times: true }).map((r) => [r[1], r[2], r[3], r[8] ?? '']), [
    ['2', 'J 1', '10:00–10:40', ''], ['–', 'J 1', '14:00–14:30', '2'], ['1', '–', '16:00–16:30', 'f']]);
  // Rounds the person only works in go with the option; before groups, the round's own times.
  assert.deepEqual(badgeRows(r3.persons[0], r3, acts3, { hideStaffOnly: true }).map((r) => r[8] ?? ''), ['', 'f']);
  assert.deepEqual(badgeRows(r3.persons[1], r3, acts3, { times: true }).map((r) => r.slice(1, 4)), [['', '–', '10:00–10:40']]);
});

test('stations, events the person only works in, local names', () => {
  // Zeynep competes in 3x3 at station 5 (as(12) has no station, so give her one here).
  const zeynep = { ...w.persons[0], name: 'Zeynep Arslan (زینب)', assignments: [{ activityId: 12, assignmentCode: 'competitor', stationNumber: 5 }, as(31, 'staff-judge')] };
  assert.deepEqual(badgeRows(zeynep, w, acts, { stations: true }).map((r) => r[7]), ['5', '']);
  // Elif only judges 3x3: with the option her row is left off.
  assert.deepEqual(badgeRows(w.persons[1], w, acts, { hideStaffOnly: true }), []);
  assert.deepEqual(badgeRows(zeynep, w, acts, { hideStaffOnly: true }).map((r) => r[0]), ['333', 'pyram']);
  assert.equal(badgePerson(zeynep, w, acts, 'en', '', { localNames: true }).localName, 'زینب');
  assert.equal(badgePerson(zeynep, w, acts, 'en').localName, '');
});

test('times and stages are options: before groups the round start, the stage once there is more than one', () => {
  const room = (id: number, name: string, color: string, activities: unknown[]) => ({ id, name, color, activities });
  const two = parseWcif(JSON.stringify({
    formatVersion: '1.1', id: 'Two2026', name: 'Two 2026', events: [{ id: '333' }, { id: '222' }, { id: 'pyram' }],
    schedule: {
      startDate: '2026-10-31', numberOfDays: 2,
      venues: [{ id: 1, name: 'V', timezone: 'Europe/Istanbul', rooms: [
        room(1, 'Red Stage', '#e8423f', [
          { ...act(10, '333-r1', '2026-10-31T07:00:00Z'), childActivities: [act(11, '333-r1-g1', '2026-10-31T07:00:00Z'), act(12, '333-r1-g2', '2026-10-31T07:30:00Z')] },
          act(20, '222-r1', '2026-11-01T07:00:00Z'),
        ]),
        room(2, 'Blue Stage', '#268bcc', [act(30, 'pyram-r1', '2026-10-31T06:00:00Z')]),
      ] }],
    },
    persons: [{ registrantId: 1, name: 'Ada Su', wcaUserId: 1, wcaId: null, countryIso2: 'TR', roles: [], registration: reg(['333', '222', 'pyram']), assignments: [as(12, 'competitor')] }],
  }));
  const acts2 = indexActivities(two);
  // Always in the competition's event order (the back sorts by time itself, the front keeps this order).
  assert.deepEqual(badgeRows(two.persons[0], two, acts2, { times: true, stages: true }), [
    ['333', '2', '–', '10:30', '2026-10-31', 'Red Stage', '#e8423f', ''],
    ['222', '', '–', '10:00', '2026-11-01', 'Red Stage', '#e8423f', ''],
    ['pyram', '', '–', '09:00', '2026-10-31', 'Blue Stage', '#268bcc', ''],
  ]);
  // Off by default; each works without the other.
  assert.deepEqual(badgeRows(two.persons[0], two, acts2).map((r) => r.join('|')), ['333|2|–|||||', '222||–|||||', 'pyram||–|||||']);
  assert.deepEqual(badgeRows(two.persons[0], two, acts2, { stages: true }).map((r) => `${r[3]}|${r[5]}`), ['|Red Stage', '|Red Stage', '|Blue Stage']);
  assert.deepEqual(badgeRows(two.persons[0], two, acts2, { times: true }).map((r) => r[5]), ['', '', '']);
});

test('titles: read from and written to the address, people by WCA user id', () => {
  const t = titleOf('PHOTOGRAPHER~FOTOĞRAFÇI~7C3AED~12.45');
  assert.deepEqual(t, { en: 'PHOTOGRAPHER', tr: 'FOTOĞRAFÇI', color: '#7c3aed', ids: [12, 45] });
  assert.equal(titleParam(t!), 'PHOTOGRAPHER~FOTOĞRAFÇI~7c3aed~12.45');
  // No English words or no colour: no title. No Turkish words or no people yet: still one.
  assert.equal(titleOf('~x~7c3aed~1'), null);
  assert.equal(titleOf('MEDIA~~zz~1'), null);
  assert.deepEqual(titleOf('MEDIA~~0d47a1~'), { en: 'MEDIA', tr: '', color: '#0d47a1', ids: [] });
  assert.equal(titleParam({ en: 'A~B ', tr: '', color: '#000000', ids: [] }), 'A B~~000000~');
});

test('group lists: in order, three or more in a row as a range', () => {
  assert.equal(groupList([10, 1, 2, 3, 4, 9]), '1–4,9,10');
  assert.equal(groupList([6, 5]), '5,6');
  assert.equal(groupList([3, 3, 1]), '1,3');
  assert.equal(groupList([2]), '2');
});

test('letters beyond J, S and R (D delegate, E data entry): the legend adds only those, in the letters\' order', () => {
  const p = { ...w.persons[1], assignments: [as(11, 'staff-dataentry'), as(12, 'staff-delegate'), as(31, 'staff-judge')] };
  const rows = badgeRows(p, w, acts);
  assert.deepEqual(rows.map((r) => r.slice(0, 3)), [['333', '–', 'E 1 D 2'], ['pyram', '–', 'J 1']]);
  assert.deepEqual(badgeLegend(rows), [['D', 'Delege', 'Delegate'], ['E', 'Veri girişi', 'Data entry']]);
  assert.deepEqual(badgePerson(w.persons[0], w, acts, 'en').legend, []);
});

test('person: registrant number, newcomer, country name, trainee delegate on the delegate band', () => {
  const zeynep = badgePerson(w.persons[0], w, acts, 'en');
  assert.equal(zeynep.id, '7');
  assert.equal(zeynep.role, 'competitor');
  const elif = badgePerson(w.persons[1], w, acts, 'tr-en');
  assert.equal(elif.wcaId, '');
  assert.equal(elif.role, 'staff');
  assert.equal(elif.countryName, 'Irak');
  const ali = badgePerson(w.persons[2], w, acts, 'en');
  assert.equal(ali.id, '');
  assert.equal(ali.role, 'delegate');
  assert.equal(ali.countryName, 'United Kingdom');
});

test('every event the kit names has an icon', () => {
  for (const id of Object.keys(EVENTS)) assert.ok(ICONS[id], id);
});

test('A4 sheets: A6 two people a sheet, A7 four, in either orientation', () => {
  const grid = (w: number, h: number) => { const g = sheetGrid(w, h); return `${g.pw}x${g.ph} ${g.cols}x${g.rows}`; };
  assert.equal(grid(105, 148), '210x297 1x2');
  assert.equal(grid(148, 105), '297x210 1x2');
  assert.equal(grid(74, 105), '297x210 2x2');
  assert.equal(grid(105, 74), '210x297 1x4');
});

test('dates without the year', () => {
  assert.deepEqual(badgeComp(w, 'en'), { name: 'Test 2026', d1: '31 OCT - 1 NOV', date: '31 OCT - 1 NOV' });
  assert.equal(dateRange('2026-10-31', 2, 'tr'), '31 EKİM - 1 KASIM');
  assert.equal(dateRange('2026-11-14', 1, 'en'), '14 NOV');
  assert.equal(dateRange('2026-11-14', 2, 'tr'), '14 - 15 KASIM');
});

test('QR: live-results links, and the code printed on the test badges', () => {
  assert.equal(liveUrl('SideQuestsIstanbul2026', 'wca_live'), 'https://live.worldcubeassociation.org/link/competitions/SideQuestsIstanbul2026');
  assert.equal(liveUrl('X2026', 'external'), 'https://worldcubeassociation.org/competitions/X2026');
  const nat = qrPath(liveUrl('NewAgeTurkey2026', 'internal'));
  assert.equal(createHash('sha256').update(nat).digest('hex').slice(0, 16), '017a153cf6f4d947');
  assert.throws(() => qrPath('https://example.org/' + 'x'.repeat(80)), /too long/);
});
