// Run with `npm test` (Node 24 strips the types). A tiny fictional WCIF covers the filter, order, roles, schedule and
// the dropping of private fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgePeople, indexActivities, parseWcif, roleOf, scheduleOf } from './wcif.ts';

const reg = (status: string, isCompeting = true) => ({ eventIds: ['333'], status, isCompeting });
const WCIF = JSON.stringify({
  formatVersion: '1.1', id: 'Test2026', name: 'Test 2026', events: [{ id: '333' }],
  schedule: {
    startDate: '2026-10-31', numberOfDays: 1,
    venues: [{ id: 1, name: 'V', timezone: 'Europe/Istanbul', rooms: [{ id: 1, name: 'Ana sahne', color: '#e30a17', activities: [
      { id: 10, activityCode: '333-r1', startTime: '2026-10-31T07:00:00Z', endTime: '2026-10-31T08:00:00Z', childActivities: [
        { id: 11, activityCode: '333-r1-g1', startTime: '2026-10-31T07:00:00Z', endTime: '2026-10-31T07:30:00Z' },
        { id: 12, activityCode: '333-r1-g2', startTime: '2026-10-31T07:30:00Z', endTime: '2026-10-31T08:00:00Z' },
      ] },
    ] }] }],
  },
  persons: [
    { registrantId: 2, name: 'Zeynep Arslan', wcaUserId: 2, wcaId: null, countryIso2: 'TR', roles: [], registration: reg('accepted'),
      email: 'z@example.org', birthdate: '2010-01-01',
      assignments: [{ activityId: 12, assignmentCode: 'competitor', stationNumber: 5 }, { activityId: 11, assignmentCode: 'staff-judge', stationNumber: null }] },
    { registrantId: 1, name: 'Çağla Demir', wcaUserId: 1, wcaId: '2019DEMI01', countryIso2: 'TR', roles: [], registration: reg('accepted'), assignments: [] },
    { registrantId: 3, name: 'Can Ak', wcaUserId: 3, wcaId: '2020AKCA01', countryIso2: 'TR', roles: [], registration: reg('pending'), assignments: [] },
    { registrantId: null, name: 'Ali Veli', wcaUserId: 4, wcaId: '2015VELI01', countryIso2: 'GB', roles: ['delegate'], registration: null, assignments: [] },
  ],
});

test('accepted people and unregistered delegates, Turkish name order, staff last', () => {
  const w = parseWcif(WCIF);
  assert.deepEqual(badgePeople(w).map((p) => p.name), ['Çağla Demir', 'Zeynep Arslan', 'Ali Veli']);
  assert.deepEqual(badgePeople(w, true).map((p) => p.name), ['Zeynep Arslan', 'Çağla Demir', 'Ali Veli']);
});

test('roles and private fields', () => {
  const w = parseWcif(WCIF);
  assert.equal(roleOf(w.persons[3]), 'delegate');
  assert.equal(roleOf(w.persons[0]), 'competitor');
  assert.equal(w.persons[0].email, undefined);
  assert.equal(w.persons[0].birthdate, undefined);
});

test('schedule: competing group and station, judging group, day in the venue time zone', () => {
  const w = parseWcif(WCIF);
  const [row] = scheduleOf(w.persons[0], indexActivities(w));
  assert.equal(row.event, '333');
  assert.equal(row.round, 1);
  assert.equal(row.group, 2);
  assert.equal(row.station, 5);
  assert.deepEqual(row.tasks, { judge: [1] });
  assert.equal(row.day, '2026-10-31');
});
