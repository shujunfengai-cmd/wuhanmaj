const SUITS = { WAN: 'wan', TONG: 'tong', TIAO: 'tiao', FENG: 'feng', JIAN: 'jian' };
const FENG_NAMES = ['dong', 'nan', 'xi', 'bei'];
const JIAN_NAMES = ['zhong', 'fa', 'bai'];

function createTile(suit, value) { return { suit, value }; }

function createDeck() {
  const tiles = [];
  for (const suit of [SUITS.WAN, SUITS.TONG, SUITS.TIAO]) {
    for (let v = 1; v <= 9; v++) {
      for (let i = 0; i < 4; i++) tiles.push(createTile(suit, v));
    }
  }
  for (const feng of FENG_NAMES) {
    for (let i = 0; i < 4; i++) tiles.push(createTile(SUITS.FENG, feng));
  }
  for (const jian of JIAN_NAMES) {
    for (let i = 0; i < 4; i++) tiles.push(createTile(SUITS.JIAN, jian));
  }
  return tiles;
}

function shuffle(tiles) {
  const arr = tiles.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tileKey(tile) { return `${tile.suit}-${tile.value}`; }

function tileDisplayName(tile) {
  const sn = { [SUITS.WAN]: 'wan', [SUITS.TONG]: 'tong', [SUITS.TIAO]: 'tiao', [SUITS.FENG]: '', [SUITS.JIAN]: '' };
  const vn = { dong: 'dong', nan: 'nan', xi: 'xi', bei: 'bei', zhong: 'hongzhong', fa: 'fa', bai: 'bai' };
  if (tile.suit === SUITS.FENG || tile.suit === SUITS.JIAN) return vn[tile.value] || tile.value;
  return `${tile.value}${sn[tile.suit]}`;
}

function tileEquals(a, b) { return a.suit === b.suit && a.value === b.value; }
function isHongZhong(tile) { return tile.suit === SUITS.JIAN && tile.value === 'zhong'; }

function getNextTile(tile) {
  if (tile.suit === SUITS.WAN || tile.suit === SUITS.TONG || tile.suit === SUITS.TIAO) {
    let nv = tile.value + 1; if (nv > 9) nv = 1;
    return createTile(tile.suit, nv);
  }
  if (tile.suit === SUITS.FENG) {
    const idx = FENG_NAMES.indexOf(tile.value);
    if (idx >= 0) return createTile(SUITS.FENG, FENG_NAMES[(idx + 1) % FENG_NAMES.length]);
  }
  if (tile.suit === SUITS.JIAN) {
    const idx = JIAN_NAMES.indexOf(tile.value);
    if (idx >= 0) return createTile(SUITS.JIAN, JIAN_NAMES[(idx + 1) % JIAN_NAMES.length]);
  }
  return tile;
}

function getPrevTile(tile) {
  if (tile.suit === SUITS.WAN || tile.suit === SUITS.TONG || tile.suit === SUITS.TIAO) {
    let pv = tile.value - 1; if (pv < 1) pv = 9;
    return createTile(tile.suit, pv);
  }
  if (tile.suit === SUITS.FENG) {
    const idx = FENG_NAMES.indexOf(tile.value);
    if (idx >= 0) return createTile(SUITS.FENG, FENG_NAMES[(idx - 1 + FENG_NAMES.length) % FENG_NAMES.length]);
  }
  if (tile.suit === SUITS.JIAN) {
    const idx = JIAN_NAMES.indexOf(tile.value);
    if (idx >= 0) return createTile(SUITS.JIAN, JIAN_NAMES[(idx - 1 + JIAN_NAMES.length) % JIAN_NAMES.length]);
  }
  return tile;
}

function tileSortCompare(a, b) {
  const so = { [SUITS.WAN]: 0, [SUITS.TONG]: 1, [SUITS.TIAO]: 2, [SUITS.FENG]: 3, [SUITS.JIAN]: 4 };
  const fo = { dong: 0, nan: 1, xi: 2, bei: 3 };
  const jo = { zhong: 0, fa: 1, bai: 2 };
  if (a.suit !== b.suit) return so[a.suit] - so[b.suit];
  if (a.suit === SUITS.FENG) return fo[a.value] - fo[b.value];
  if (a.suit === SUITS.JIAN) return jo[a.value] - jo[b.value];
  return a.value - b.value;
}

module.exports = {
  SUITS, FENG_NAMES, JIAN_NAMES,
  createTile, createDeck, shuffle,
  tileKey, tileDisplayName, tileEquals,
  isHongZhong, getNextTile, getPrevTile, tileSortCompare
};
