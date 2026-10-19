// Podiums for the certificates: each event's final round, top three, from the WCIF (live for the WCA site's own live
// results; as of the last sync for WCA Live), straight from WCA Live, or from the posted results.

import { WCA_API, type Result, type Round, type Wcif } from './wcif.ts';

export type Place = { place: number; name: string; wcaId: string | null; country: string; registrantId: number | null; best: number; average: number };
export type PodiumState = 'waiting' | 'running' | 'done';
export type Podium = { event: string; round: number; format: string; state: PodiumState; places: Place[] };

const ATTEMPTS: Record<string, number> = { a: 5, m: 3, '1': 1, '2': 2, '3': 3, '5': 5 };

// A result is complete with all its attempts, or with the cutoff's attempts when none of them beat the cutoff.
// Smaller is better for every event, Multi-Blind's encoding included. A head-to-head round ('h') has no set number of
// attempts, so the WCIF cannot tell when it is over: its podium waits for WCA Live or the posted results.
export function complete(r: Result, round: Round): boolean {
  if (round.format === 'h') return false;
  const n = r.attempts.length;
  const c = round.cutoff;
  if (c && n === c.numberOfAttempts && !r.attempts.some((a) => a.value > 0 && a.value < c.resultValue)) return true;
  return n >= (ATTEMPTS[round.format] ?? 1);
}

// A podium place needs a ranking of 3 or better and at least one successful attempt; ties share a place.
export function podiumsFromWcif(w: Wcif): Podium[] {
  const people = new Map(w.persons.map((p) => [p.registrantId, p]));
  return w.events.filter((e) => e.rounds?.length).map((e) => {
    const round = e.rounds![e.rounds!.length - 1];
    const results = round.results ?? [];
    const state: PodiumState = results.length && results.every((r) => complete(r, round)) ? 'done'
      : results.some((r) => r.attempts.length) ? 'running' : 'waiting';
    const places = state !== 'done' ? [] : results
      .filter((r) => r.ranking != null && r.ranking <= 3 && r.best > 0)
      .sort((a, b) => a.ranking! - b.ranking!)
      .map((r) => {
        const p = people.get(r.personId);
        return { place: r.ranking!, name: p?.name ?? '?', wcaId: p?.wcaId ?? null, country: p?.countryIso2 ?? '', registrantId: r.personId, best: r.best, average: r.average };
      });
    return { event: e.id, round: Number(round.id.split('-r')[1]), format: round.format, state, places };
  });
}

type LiveResult = { ranking: number | null; best: number; average: number; person: { name: string; wcaId: string | null; registrantId: number | null; country: { iso2: string } } };
export type LivePodium = {
  round: { number: number; finished: boolean; numEnteredResults: number; format: { id: string }; competitionEvent: { event: { id: string } } };
  results: LiveResult[];
};

export function podiumFromLive(p: LivePodium): Podium {
  const state: PodiumState = p.round.finished ? 'done' : p.round.numEnteredResults ? 'running' : 'waiting';
  return {
    event: p.round.competitionEvent.event.id,
    round: p.round.number,
    format: p.round.format.id,
    state,
    places: state !== 'done' ? [] : p.results
      .filter((r) => r.ranking != null && r.ranking <= 3 && r.best > 0)
      .sort((a, b) => a.ranking! - b.ranking!)
      .map((r) => ({ place: r.ranking!, name: r.person.name, wcaId: r.person.wcaId, country: r.person.country.iso2, registrantId: r.person.registrantId, best: r.best, average: r.average })),
  };
}

const WCA_LIVE = 'https://live.worldcubeassociation.org/api';

async function live<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(WCA_LIVE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  if (!res.ok) throw new Error(`live-http-${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: unknown[] };
  if (body.errors?.length || !body.data) throw new Error('live-error');
  return body.data;
}

// WCA Live knows a competition only once the delegate has imported it; then it is found by its name and checked
// by its WCA ID. Null when it is not there.
export async function fetchLivePodiums(w: Wcif): Promise<Podium[] | null> {
  const found = await live<{ competitions: { id: string; wcaId: string }[] }>(
    'query ($f: String) { competitions(filter: $f, limit: 10) { id wcaId } }', { f: w.name });
  const id = found.competitions.find((c) => c.wcaId === w.id)?.id;
  if (!id) return null;
  const data = await live<{ competition: { podiums: LivePodium[] } }>(`query ($id: ID!) { competition(id: $id) { podiums {
    round { number finished numEnteredResults format { id } competitionEvent { event { id } } }
    results { ranking best average person { name wcaId registrantId country { iso2 } } } } } }`, { id });
  return data.competition.podiums.map(podiumFromLive);
}

// One entry per person and round of the posted results (the WCA's /competitions/:id/results).
export type PostedResult = {
  pos: number; best: number; average: number; name: string; country_iso2: string; wca_id: string | null;
  event_id: string; round_type_id: string; format_id: string;
};

// Once the results are posted, the WCIF may no longer carry them and WCA Live may no longer know the competition.
// Each event's final ('f', or 'c' after a cutoff) gives the places; an event without a posted final stays waiting.
export function podiumsFromResults(results: PostedResult[], w: Wcif): Podium[] {
  return w.events.filter((e) => e.rounds?.length).map((e) => {
    const final = results.filter((r) => r.event_id === e.id && (r.round_type_id === 'f' || r.round_type_id === 'c'));
    const state: PodiumState = final.length ? 'done' : 'waiting';
    return {
      event: e.id,
      round: e.rounds!.length,
      format: final[0]?.format_id ?? e.rounds![e.rounds!.length - 1].format,
      state,
      places: final
        .filter((r) => r.pos <= 3 && r.best > 0)
        .sort((a, b) => a.pos - b.pos)
        .map((r) => ({ place: r.pos, name: r.name, wcaId: r.wca_id, country: r.country_iso2, registrantId: null, best: r.best, average: r.average })),
    };
  });
}

export async function fetchPostedPodiums(w: Wcif): Promise<Podium[]> {
  const res = await fetch(`${WCA_API}/competitions/${encodeURIComponent(w.id)}/results`);
  if (!res.ok) throw new Error(`http-${res.status}`);
  return podiumsFromResults((await res.json()) as PostedResult[], w);
}

// The result that decides the place: the average in average and mean rounds, the best single otherwise (and when
// the average is DNF).
export function decidingResult(format: string, p: Place): { value: number; kind: 'average' | 'mean' | 'single' } {
  if ((format === 'a' || format === 'm') && p.average > 0) return { value: p.average, kind: format === 'a' ? 'average' : 'mean' };
  return { value: p.best, kind: 'single' };
}

const clock = (cs: number) => {
  const h = Math.floor(cs / 360000);
  const m = Math.floor(cs / 6000) % 60;
  const s = `${Math.floor(cs / 100) % 60}.${String(cs % 100).padStart(2, '0')}`;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${s.padStart(5, '0')}`;
  return m ? `${m}:${s.padStart(5, '0')}` : s;
};

// WCA result values: centiseconds; -1 DNF, -2 DNS, 0 none. Fewest Moves singles are moves and its averages moves
// × 100. Multi-Blind is 0DDTTTTTMM: 99 − DD points, TTTTT seconds, MM unsolved; its time is shown in minutes, as
// on the WCA site (60:00 at most).
export function formatResult(value: number, event: string, average = false): string {
  if (value === -1) return 'DNF';
  if (value === -2) return 'DNS';
  if (value <= 0) return '';
  if (event === '333fm') return average ? (value / 100).toFixed(2) : String(value);
  if (event === '333mbf') {
    const missed = value % 100;
    const seconds = Math.floor(value / 100) % 100000;
    const solved = 99 - (Math.floor(value / 1e7) % 100) + missed;
    return `${solved}/${solved + missed} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return clock(value);
}
