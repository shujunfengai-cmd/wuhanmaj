const Tile = require('./tile');

// 番型计算器
class FanCalculator {
  constructor(laizi) {
    this.laizi = laizi;
  }

  calculate(handTiles, melds, winType, mingGangCount, anGangCount) {
    let fan = 0;
    const allTiles = [...handTiles, ...melds.flatMap(m => m.tiles)];

    // 碰碰胡（3番）
    if (this.isPengPengHu(handTiles, melds)) {
      fan = 3;
    }
    // 清一色（3番）
    else if (this.isQingYiSe(allTiles)) {
      fan = 3;
    }
    // 风一色（4番）
    else if (this.isFengYiSe(allTiles)) {
      fan = 4;
    }
    // 将一色（4番）
    else if (this.isJiangYiSe(allTiles)) {
      fan = 4;
    }
    // 平胡（1番）
    else {
      fan = 1;
    }

    // 杠加成（每个明杠/暗杠+1番）
    fan += (mingGangCount || 0);
    fan += (anGangCount || 0);

    // 自摸+1
    if (winType === 'zimo') fan += 1;
    // 杠上开花+1
    if (winType === 'gangShangKaiHua') fan += 1;
    // 抢杠胡+1
    if (winType === 'qiangGangHu') fan += 1;
    // 海底捞月+1
    if (winType === 'haiDiLaoYue') fan += 1;

    return fan;
  }

  // 碰碰胡：4副碰/杠 + 1对
  isPengPengHu(handTiles, melds) {
    // 手牌必须是刻子或对的组合
    const counts = {};
    for (const t of handTiles) {
      const k = Tile.tileKey(t);
      counts[k] = (counts[k] || 0) + 1;
    }
    // 所有非赖子手牌必须是对子或刻子
    for (const [k, c] of Object.entries(counts)) {
      const t = this.keyToTile(k);
      if (Tile.tileEquals(t, this.laizi)) continue; // 赖子灵活处理
      if (c !== 2 && c !== 3 && c !== 4) return false;
    }
    // 检查副露是否全为碰/杠
    for (const m of melds) {
      if (m.type === 'chi') return false;
    }
    return true;
  }

  // 清一色
  isQingYiSe(allTiles) {
    const suits = new Set(allTiles.map(t => t.suit));
    // 只允许一种数牌（万/筒/条）
    if (suits.size !== 1) return false;
    const s = Array.from(suits)[0];
    return s === Tile.SUITS.WAN || s === Tile.SUITS.TONG || s === Tile.SUITS.TIAO;
  }

  // 风一色
  isFengYiSe(allTiles) {
    return allTiles.every(t => t.suit === Tile.SUITS.FENG || t.suit === Tile.SUITS.JIAN);
  }

  // 将一色
  isJiangYiSe(allTiles) {
    return allTiles.every(t => {
      if (t.suit === Tile.SUITS.FENG || t.suit === Tile.SUITS.JIAN) return true;
      return t.value === 2 || t.value === 5 || t.value === 8;
    });
  }

  keyToTile(key) {
    const [suit, value] = key.split('-');
    return Tile.createTile(suit, isNaN(value) ? value : parseInt(value));
  }
}

module.exports = FanCalculator;
