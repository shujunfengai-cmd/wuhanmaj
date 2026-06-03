const Tile = require('./tile');

// 风牌顺序：东->南->西->北->中->发->白
const WIND_CYCLE = ['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai'];

// 赖子/皮子规则
function computeLaiziAndPiZi(flippedTile) {
  let laizi = Tile.getNextTile(flippedTile);
  // 红中不能是赖子，顺延
  if (Tile.isHongZhong(laizi)) {
    laizi = Tile.getNextTile(laizi);
  }

  const piZi = [];
  // 本张为皮子
  piZi.push(flippedTile);
  // 上一张为皮子
  piZi.push(Tile.getPrevTile(flippedTile));
  // 红中固定为皮子
  const hongZhong = Tile.createTile(Tile.SUITS.JIAN, 'zhong');
  if (!piZi.some(t => Tile.tileEquals(t, hongZhong))) {
    piZi.push(hongZhong);
  }
  // 翻到红中时，额外加西（上两张）
  if (Tile.isHongZhong(flippedTile)) {
    const xi = Tile.createTile(Tile.SUITS.FENG, 'xi');
    if (!piZi.some(t => Tile.tileEquals(t, xi))) {
      piZi.push(xi);
    }
  }

  return { laizi, piZi };
}

// 番型定义
const FAN_TYPES = {
  PING_HU: { name: 'pingHu', display: '平胡', fan: 1 },
  PENG_PENG_HU: { name: 'pengPengHu', display: '碰碰胡', fan: 3 },
  QING_YI_SE: { name: 'qingYiSe', display: '清一色', fan: 3 },
  FENG_YI_SE: { name: 'fengYiSe', display: '风一色', fan: 4 },
  JIANG_YI_SE: { name: 'jiangYiSe', display: '将一色', fan: 4 }
};

// 额外加番
const EXTRA_FAN = {
  ZIMO: { name: 'zimo', display: '自摸', fan: 1 },
  GANG_SHANG_KAI_HUA: { name: 'gangShangKaiHua', display: '杠上开花', fan: 1 },
  QIANG_GANG_HU: { name: 'qiangGangHu', display: '抢杠胡', fan: 1 },
  HAI_DI_LAO_YUE: { name: 'haiDiLaoYue', display: '海底捞月', fan: 1 }
};

// 计分公式
function calculateScore(baseFan) {
  if (baseFan <= 0) return 0;
  return 10 * Math.pow(2, baseFan - 1);
}

// 开口检查
function isOpenClaim(claimType) {
  return ['chi', 'peng', 'mingGang'].includes(claimType);
}

// 特殊可门清胡牌型
function isSpecialDoorClearHand(hand, melds) {
  // 风一色、将一色、十三烂
  return isFengYiSe(hand, melds) || isJiangYiSe(hand, melds) || isShiSanLan(hand, melds);
}

function isFengYiSe(hand, melds) {
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  return allTiles.every(t => t.suit === Tile.SUITS.FENG || t.suit === Tile.SUITS.JIAN);
}

function isJiangYiSe(hand, melds) {
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  return allTiles.every(t => {
    if (t.suit === Tile.SUITS.FENG || t.suit === Tile.SUITS.JIAN) return true;
    return t.value === 2 || t.value === 5 || t.value === 8;
  });
}

function isShiSanLan(hand, melds) {
  // 简化版十三烂：不实现
  return false;
}

module.exports = {
  WIND_CYCLE,
  computeLaiziAndPiZi,
  FAN_TYPES,
  EXTRA_FAN,
  calculateScore,
  isOpenClaim,
  isSpecialDoorClearHand
};
