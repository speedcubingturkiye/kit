// QR code (model 2) for the badge's live-results link: version 5 (37 × 37 modules), error correction M, byte mode,
// up to 84 bytes. That is the size the badge designs reserve (viewBox -2 -2 41 41, with a 2-module quiet zone).

const VER = 5;
const SIZE = 17 + 4 * VER;
const DATA_CW = 86;
const BLOCKS = 2;
const ECC_CW = 24;

const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
for (let i = 0, v = 1; i < 255; i++) {
  EXP[i] = v;
  LOG[v] = i;
  v <<= 1;
  if (v & 0x100) v ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

let GEN = [1];
for (let i = 0; i < ECC_CW; i++) {
  const n = new Array<number>(GEN.length + 1).fill(0);
  for (let j = 0; j < GEN.length; j++) {
    n[j] ^= GEN[j];
    n[j + 1] ^= mul(GEN[j], EXP[i]);
  }
  GEN = n;
}

function rsRemainder(msg: number[]): number[] {
  const res = new Array<number>(ECC_CW).fill(0);
  for (const b of msg) {
    const f = b ^ (res.shift() ?? 0);
    res.push(0);
    for (let j = 0; j < ECC_CW; j++) res[j] ^= mul(GEN[j + 1], f);
  }
  return res;
}

function codewords(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 84) throw new Error('qr: text too long for version 5-M');
  const bits: number[] = [];
  const put = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4);
  put(bytes.length, 8);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, DATA_CW * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    data.push(v);
  }
  for (let pad = 0xec; data.length < DATA_CW; pad ^= 0xec ^ 0x11) data.push(pad);
  const per = DATA_CW / BLOCKS;
  const blocks: number[][] = [];
  for (let b = 0; b < BLOCKS; b++) blocks.push(data.slice(b * per, (b + 1) * per));
  const eccs = blocks.map(rsRemainder);
  const out: number[] = [];
  for (let i = 0; i < per; i++) for (const blk of blocks) out.push(blk[i]);
  for (let i = 0; i < ECC_CW; i++) for (const e of eccs) out.push(e[i]);
  return { out, blocks, eccs };
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(c / 3) + Math.floor(r / 2)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function drawFormat(m: number[][], mask: number) {
  const data = mask; // error correction level M = 0b00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => (bits >>> i) & 1;
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6);
  m[8][8] = bit(7);
  m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][SIZE - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[SIZE - 15 + i][8] = bit(i);
  m[SIZE - 8][8] = 1;
}

function penalty(m: number[][]) {
  let p = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < SIZE; i++) {
      let run = 1;
      for (let j = 1; j < SIZE; j++) {
        const a = pass ? m[j][i] : m[i][j];
        const b = pass ? m[j - 1][i] : m[i][j - 1];
        if (a === b) {
          run++;
          if (run === 5) p += 3;
          else if (run > 5) p += 1;
        } else run = 1;
      }
    }
  }
  for (let r = 0; r < SIZE - 1; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
    }
  }
  const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j <= SIZE - 11; j++) {
        let a = true;
        let b = true;
        for (let k = 0; k < 11; k++) {
          const v = pass ? m[j + k][i] : m[i][j + k];
          if (v !== p1[k]) a = false;
          if (v !== p2[k]) b = false;
        }
        if (a) p += 40;
        if (b) p += 40;
      }
    }
  }
  let dark = 0;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) dark += m[r][c];
  p += Math.floor(Math.abs((dark * 100) / (SIZE * SIZE) - 50) / 5) * 10;
  return p;
}

function placement(fn: boolean[][]) {
  const order: [number, number][] = [];
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < SIZE; v++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const r = upward ? SIZE - 1 - v : v;
        if (!fn[r][c]) order.push([r, c]);
      }
    }
  }
  return order;
}

export function qrMatrix(text: string): number[][] {
  const cw = codewords(text);
  const base = [...Array(SIZE)].map(() => new Array<number>(SIZE).fill(0));
  const fn = [...Array(SIZE)].map(() => new Array<boolean>(SIZE).fill(false));
  const set = (r: number, c: number, v: number) => { base[r][c] = v; fn[r][c] = true; };
  for (const [or, oc] of [[0, 0], [0, SIZE - 7], [SIZE - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = or + r;
        const cc = oc + c;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        set(rr, cc, ring === 2 || ring === 4 ? 0 : 1);
      }
    }
  }
  for (let i = 0; i < SIZE; i++) {
    if (!fn[6][i]) set(6, i, i % 2 === 0 ? 1 : 0);
    if (!fn[i][6]) set(i, 6, i % 2 === 0 ? 1 : 0);
  }
  for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) set(30 + r, 30 + c, Math.max(Math.abs(r), Math.abs(c)) === 1 ? 0 : 1);
  for (let i = 0; i < 9; i++) {
    if (!fn[8][i]) set(8, i, 0);
    if (!fn[i][8]) set(i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    set(8, SIZE - 1 - i, 0);
    set(SIZE - 1 - i, 8, 0);
  }
  set(SIZE - 8, 8, 1);
  const order = placement(fn);
  const raw = base.map((row) => row.slice());
  order.forEach(([r, c], k) => { raw[r][c] = k < cw.out.length * 8 ? (cw.out[k >>> 3] >>> (7 - (k & 7))) & 1 : 0; });
  let best: { matrix: number[][]; penalty: number; mask: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = raw.map((row, r) => row.map((v, c) => (fn[r][c] ? v : v ^ (MASKS[mask](r, c) ? 1 : 0))));
    drawFormat(m, mask);
    const p = penalty(m);
    if (!best || p < best.penalty) best = { matrix: m, penalty: p, mask };
  }
  const { matrix, mask } = best!;
  // Self-checks: every block is a valid Reed-Solomon codeword, and the matrix reads back to the same codewords.
  const rsOk = cw.blocks.every((blk, i) => rsRemainder(blk.concat(cw.eccs[i])).every((v) => v === 0));
  const back: number[] = [];
  order.forEach(([r, c], k) => {
    if (k >= cw.out.length * 8) return;
    const v = matrix[r][c] ^ (MASKS[mask](r, c) ? 1 : 0);
    back[k >>> 3] = ((back[k >>> 3] ?? 0) << 1) | v;
  });
  const readOk = back.length === cw.out.length && back.every((v, i) => v === cw.out[i]);
  if (!rsOk || !readOk) throw new Error('qr: self-check failed');
  return matrix;
}

// The dark modules as one SVG path, a rectangle per run along each row.
export function qrPath(text: string): string {
  let d = '';
  qrMatrix(text).forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) { c++; continue; }
      let e = c;
      while (e < row.length && row[e]) e++;
      d += `M${c} ${r}h${e - c}v1h-${e - c}z`;
      c = e;
    }
  });
  return d;
}
