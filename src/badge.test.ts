// Run with `npm test`. A small fictional WCIF covers the badge rows, roles and dates; the QR is pinned to the code on
// the New Age Turkey 2026 test prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { badgeComp, badgeLegend, badgePerson, badgeRows, dateRange, liveUrl, sheetGrid } from './badge.ts';
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
  // The time is the person's earliest own group in the round (judging group 1 before competing in group 2).
  assert.deepEqual(badgeRows(w.persons[0], w, acts), [['333', '2', 'J 1', '10:00', '2026-10-31', '', ''], ['pyram', '', 'J 1 S 1', '12:00', '2026-10-31', '', '']]);
  assert.deepEqual(badgeRows(w.persons[1], w, acts), [['333', '–', 'J 1,2', '10:00', '2026-10-31', '', '']]);
  assert.deepEqual(badgeRows(w.persons[2], w, acts), []);
});

test('rows in time order with stages: before groups the round start, the stage once there is more than one', () => {
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
  assert.deepEqual(badgeRows(two.persons[0], two, indexActivities(two)), [
    ['pyram', '', '–', '09:00', '2026-10-31', 'Blue Stage', '#268bcc'],
    ['333', '2', '–', '10:30', '2026-10-31', 'Red Stage', '#e8423f'],
    ['222', '', '–', '10:00', '2026-11-01', 'Red Stage', '#e8423f'],
  ]);
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
