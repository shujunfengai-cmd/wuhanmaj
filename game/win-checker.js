const Tile = require('./tile');
const Rules = require('./rules');

// 胡牌判定器
class WinChecker {
  constructor(laizi, piZiTiles) {
    this.laizi = laizi;
    this.piZiTiles = piZiTiles || [];
  }

  // 检查是否含皮子
  hasPiZi(tiles) {
    return tiles.some(t => this.piZiTiles.some(pz => Tile.tileEquals(t, pz)));
  }

  // 主入口：检查手牌+副露是否可胡
  canHu(handTiles, melds, hasOpened) {
    // 1. 皮子拦截
    if (this.hasPiZi(handTiles)) {
      return { canHu: false, reason: 'hasPiZi' };
    }
    // 2. 开口检查（特殊牌型除外）
    const allTiles = [...handTiles, ...melds.flatMap(m => m.tiles)];
    const isSpecial = Rules.isSpecialDoorClearHand(handTiles, melds);
    if (!hasOpened && !isSpecial) {
      return { canHu: false, reason: 'notOpened' };
    }

    // 3. 七对拦截
    if (this.isQiDui(handTiles)) {
      return { canHu: false, reason: 'qiDuiNotAllowed' };
    }

    // 4. 标准胡牌判定（4副+1对）
    return this.checkStandardHu(handTiles, melds);
  }

  // 检查七对（仅用于拦截，不允许胡）
  isQiDui(tiles) {
    if (tiles.length !== 14) return false;
    const counts = {};
    for (const t of tiles) {
      const k = Tile.tileKey(t);
      counts[k] = (counts[k] || 0) + 1;
    }
    let pairs = 0;
    for (const c of Object.values(counts)) {
      if (c === 2) pairs++;
      else if (c === 4) pairs += 2;
      else return false;
    }
    return pairs === 7;
  }

  // 标准胡牌：4副（刻子或顺子）+ 1对
  checkStandardHu(handTiles, melds) {
    // 总牌数检查：手牌14张（含赖子情况复杂，先不严格检查）
    // 分离赖子
    const laiziList = [];
    const normalTiles = [];
    for (const t of handTiles) {
      if (this.isLaiziTile(t)) laiziList.push(t);
      else normalTiles.push(t);
    }

    // 副露中已有n副，手牌需要 (4 - n)副 + 1对
    const existingSets = melds.filter(m => m.type !== 'piZiGang').length;
    const neededSets = 4 - existingSets;

    // 尝试用赖子凑成胡牌
    const result = this.trySplit(normalTiles, laiziList.length, neededSets);
    if (result) {
      return { canHu: true, sets: result };
    }
    return { canHu: false, reason: 'noValidCombination' };
  }

  // 递归尝试拆分手牌为 刻子/顺子/对子
  trySplit(tiles, laiziCount, neededSets) {
    // 统计各牌数量
    const counts = {};
    for (const t of tiles) {
      const k = Tile.tileKey(t);
      counts[k] = (counts[k] || 0) + 1;
    }
    const keys = Object.keys(counts);

    // 辅助：获取key对应的tile
    const keyToTile = (k) => {
      const [suit, value] = k.split('-');
      return Tile.createTile(suit, isNaN(value) ? value : parseInt(value));
    };

    // 尝试找到对子，然后剩余拆分为刻子/顺子
    return this.findPairAndSets(counts, laiziCount, neededSets, keyToTile);
  }

  findPairAndSets(counts, laiziCount, neededSets, keyToTile) {
    const keys = Object.keys(counts).filter(k => counts[k] > 0);

    // 尝试每个key作为对子
    for (const pairKey of keys) {
      const newCounts = { ...counts };
      let remainingLaizi = laiziCount;

      // 用该key做一对
      if (newCounts[pairKey] >= 2) {
        newCounts[pairKey] -= 2;
      } else if (newCounts[pairKey] === 1 && remainingLaizi >= 1) {
        newCounts[pairKey] -= 1;
        remainingLaizi -= 1;
      } else if (remainingLaizi >= 2) {
        remainingLaizi -= 2;
      } else {
        continue;
      }

      // 剩余牌 + 剩余赖子 需要拆成 neededSets 副
      if (this.canSplitIntoSets(newCounts, remainingLaizi, neededSets, keyToTile)) {
        return true;
      }
    }

    // 尝试纯赖子做对子
    if (laiziCount >= 2) {
      const newCounts = { ...counts };
      if (this.canSplitIntoSets(newCounts, laiziCount - 2, neededSets, keyToTile)) {
        return true;
      }
    }

    return false;
  }

  canSplitIntoSets(counts, laiziCount, neededSets, keyToTile) {
    // 获取所有有数量的key
    const keys = Object.keys(counts).filter(k => counts[k] > 0);

    // 如果没有牌了，检查赖子是否能凑够
    if (keys.length === 0) {
      // 每组刻子/顺子需要3张，但赖子可以替代
      // 简化：每个赖子可以当1张牌，需要3*neededSets张
      // 实际上赖子更灵活：3个赖子=1副，2赖子+1张=1副，1赖子+2张=1副
      // 简化判断：如果剩余赖子 >= neededSets * 3，可以全部用赖子凑
      return laiziCount >= neededSets * 3;
    }

    if (neededSets === 0) {
      // 不需要更多副了，但还有牌，失败
      return keys.length === 0 && laiziCount === 0;
    }

    // 取最小key尝试组成刻子或顺子
    const firstKey = keys[0];
    const firstTile = keyToTile(firstKey);
    const firstCount = counts[firstKey];

    // 尝试刻子（3张相同）
    const newCountsKe = { ...counts };
    let laiziKe = laiziCount;
    if (firstCount >= 3) {
      newCountsKe[firstKey] -= 3;
    } else if (firstCount === 2 && laiziKe >= 1) {
      newCountsKe[firstKey] -= 2;
      laiziKe -= 1;
    } else if (firstCount === 1 && laiziKe >= 2) {
      newCountsKe[firstKey] -= 1;
      laiziKe -= 2;
    } else if (laiziKe >= 3) {
      laiziKe -= 3;
    } else {
      // 刻子失败，尝试顺子
      return this.tryShunzi(counts, laiziCount, neededSets, keyToTile, firstKey, firstTile);
    }

    if (this.canSplitIntoSets(newCountsKe, laiziKe, neededSets - 1, keyToTile)) {
      return true;
    }

    // 刻子失败，尝试顺子
    return this.tryShunzi(counts, laiziCount, neededSets, keyToTile, firstKey, firstTile);
  }

  tryShunzi(counts, laiziCount, neededSets, keyToTile, firstKey, firstTile) {
    // 只有万/筒/条能组成顺子
    if (firstTile.suit === Tile.SUITS.FENG || firstTile.suit === Tile.SUITS.JIAN) {
      return false;
    }
    const v = firstTile.value;
    const suit = firstTile.suit;
    const k2 = `${suit}-${v + 1}`;
    const k3 = `${suit}-${v + 2}`;

    const c1 = counts[firstKey] || 0;
    const c2 = counts[k2] || 0;
    const c3 = counts[k3] || 0;

    // 尝试用赖子补齐顺子
    for (let useL1 = 0; useL1 <= Math.min(1, c1 > 0 ? 0 : 1, laiziCount); useL1++) {
      for (let useL2 = 0; useL2 <= Math.min(1, c2 > 0 ? 0 : 1, laiziCount - useL1); useL2++) {
        for (let useL3 = 0; useL3 <= Math.min(1, c3 > 0 ? 0 : 1, laiziCount - useL1 - useL2); useL3++) {
          const need1 = 1 - useL1;
          const need2 = 1 - useL2;
          const need3 = 1 - useL3;
          if (c1 >= need1 && c2 >= need2 && c3 >= need3) {
            // Actually simpler: try all combos where total needed <= available
          }
        }
      }
    }

    // 简化版：只尝试不用赖子或最多用赖子的情况
    const combos = [
      { u1: 0, u2: 0, u3: 0 },
      { u1: 1, u2: 0, u3: 0 }, { u1: 0, u2: 1, u3: 0 }, { u1: 0, u2: 0, u3: 1 },
      { u1: 1, u2: 1, u3: 0 }, { u1: 1, u2: 0, u3: 1 }, { u1: 0, u2: 1, u3: 1 },
      { u1: 1, u2: 1, u3: 1 }
    ];
    for (const combo of combos) {
      const totalL = combo.u1 + combo.u2 + combo.u3;
      if (totalL > laiziCount) continue;
      const need1 = 1 - combo.u1;
      const need2 = 1 - combo.u2;
      const need3 = 1 - combo.u3;
      if (c1 >= need1 && c2 >= need2 && c3 >= need3 && need1 + need2 + need3 <= c1 + c2 + c3) {
        const newCounts = { ...counts };
        newCounts[firstKey] -= need1;
        newCounts[k2] = (newCounts[k2] || 0) - need2;
        newCounts[k3] = (newCounts[k3] || 0) - need3;
        if (newCounts[firstKey] === 0) delete newCounts[firstKey];
        if (newCounts[k2] === 0) delete newCounts[k2];
        if (newCounts[k3] === 0) delete newCounts[k3];
        if (this.canSplitIntoSets(newCounts, laiziCount - totalL, neededSets - 1, keyToTile)) {
          return true;
        }
      }
    }
    return false;
  }

  isLaiziTile(tile) {
    return Tile.tileEquals(tile, this.laizi);
  }
}

module.exports = WinChecker;
