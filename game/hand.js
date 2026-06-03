const Tile = require('./tile');

class Hand {
  constructor(tiles = []) {
    this.tiles = tiles.slice().sort(Tile.tileSortCompare);
    this.melds = []; // 副露: {type: 'chi'|'peng'|'gang', tiles: [...]}
  }

  add(tile) {
    this.tiles.push(tile);
    this.tiles.sort(Tile.tileSortCompare);
  }

  remove(index) {
    if (index < 0 || index >= this.tiles.length) return null;
    return this.tiles.splice(index, 1)[0];
  }

  removeTile(tile) {
    const idx = this.tiles.findIndex(t => Tile.tileEquals(t, tile));
    if (idx >= 0) return this.tiles.splice(idx, 1)[0];
    return null;
  }

  // 查找可吃的组合
  findChiOptions(targetTile) {
    if (targetTile.suit === Tile.SUITS.FENG || targetTile.suit === Tile.SUITS.JIAN) return [];
    const v = targetTile.value;
    const suit = targetTile.suit;
    const has = val => this.tiles.some(t => t.suit === suit && t.value === val);
    const options = [];
    // 吃上家：target 是中间或末尾
    // 例如 target=5, 需要 3,4 或 4,6 或 6,7
    const combos = [
      [v - 2, v - 1], // target 是末尾
      [v - 1, v + 1], // target 是中间
      [v + 1, v + 2]  // target 是开头
    ];
    for (const combo of combos) {
      const [a, b] = combo;
      if (a >= 1 && a <= 9 && b >= 1 && b <= 9) {
        if (has(a) && has(b)) {
          options.push([
            Tile.createTile(suit, a),
            Tile.createTile(suit, b)
          ]);
        }
      }
    }
    return options;
  }

  // 查找可碰
  canPeng(targetTile) {
    const count = this.tiles.filter(t => Tile.tileEquals(t, targetTile)).length;
    return count >= 2;
  }

  // 查找可明杠（手牌有3张相同，加打出的1张）
  canMingGang(targetTile) {
    const count = this.tiles.filter(t => Tile.tileEquals(t, targetTile)).length;
    return count >= 3;
  }

  // 查找可暗杠（手牌有4张相同）
  canAnGang() {
    const gangs = [];
    const checked = new Set();
    for (const t of this.tiles) {
      const key = Tile.tileKey(t);
      if (checked.has(key)) continue;
      checked.add(key);
      const count = this.tiles.filter(x => Tile.tileEquals(x, t)).length;
      if (count === 4) gangs.push(t);
    }
    return gangs;
  }

  // 查找可加杠（手牌有1张，且已有碰）
  canJiaGang() {
    const gangs = [];
    for (const meld of this.melds) {
      if (meld.type === 'peng') {
        const hasExtra = this.tiles.some(t => Tile.tileEquals(t, meld.tiles[0]));
        if (hasExtra) gangs.push(meld.tiles[0]);
      }
    }
    return gangs;
  }

  // 执行吃
  doChi(targetTile, comboTiles) {
    const removed = [];
    for (const t of comboTiles) {
      const rt = this.removeTile(t);
      if (rt) removed.push(rt);
    }
    if (removed.length === 2) {
      this.melds.push({ type: 'chi', tiles: [...comboTiles, targetTile].sort(Tile.tileSortCompare) });
      return true;
    }
    // 回退
    for (const t of removed) this.tiles.push(t);
    this.tiles.sort(Tile.tileSortCompare);
    return false;
  }

  // 执行碰
  doPeng(targetTile) {
    const removed = [];
    for (let i = 0; i < 2; i++) {
      const t = this.removeTile(targetTile);
      if (t) removed.push(t);
    }
    if (removed.length === 2) {
      this.melds.push({ type: 'peng', tiles: [targetTile, targetTile, targetTile] });
      return true;
    }
    for (const t of removed) this.tiles.push(t);
    this.tiles.sort(Tile.tileSortCompare);
    return false;
  }

  // 执行明杠
  doMingGang(targetTile) {
    const removed = [];
    for (let i = 0; i < 3; i++) {
      const t = this.removeTile(targetTile);
      if (t) removed.push(t);
    }
    if (removed.length === 3) {
      this.melds.push({ type: 'mingGang', tiles: [targetTile, targetTile, targetTile, targetTile] });
      return true;
    }
    for (const t of removed) this.tiles.push(t);
    this.tiles.sort(Tile.tileSortCompare);
    return false;
  }

  // 执行暗杠
  doAnGang(tile) {
    const removed = [];
    for (let i = 0; i < 4; i++) {
      const t = this.removeTile(tile);
      if (t) removed.push(t);
    }
    if (removed.length === 4) {
      this.melds.push({ type: 'anGang', tiles: [tile, tile, tile, tile], hidden: true });
      return true;
    }
    for (const t of removed) this.tiles.push(t);
    this.tiles.sort(Tile.tileSortCompare);
    return false;
  }

  // 执行加杠
  doJiaGang(tile) {
    const meld = this.melds.find(m => m.type === 'peng' && Tile.tileEquals(m.tiles[0], tile));
    if (!meld) return false;
    const removed = this.removeTile(tile);
    if (!removed) return false;
    meld.type = 'mingGang';
    meld.tiles.push(tile);
    return true;
  }

  // 执行皮子杠
  doPiZiGang(piZiTile) {
    const removed = this.removeTile(piZiTile);
    if (removed) {
      this.melds.push({ type: 'piZiGang', tiles: [piZiTile] });
      return true;
    }
    return false;
  }

  // 获取手牌中皮子的索引
  findPiZiIndices(piZiTiles) {
    const indices = [];
    for (let i = 0; i < this.tiles.length; i++) {
      if (piZiTiles.some(pz => Tile.tileEquals(this.tiles[i], pz))) {
        indices.push(i);
      }
    }
    return indices;
  }

  clone() {
    const h = new Hand(this.tiles.map(t => Tile.createTile(t.suit, t.value)));
    h.melds = this.melds.map(m => ({ ...m, tiles: m.tiles.map(t => Tile.createTile(t.suit, t.value)) }));
    return h;
  }
}

module.exports = Hand;
