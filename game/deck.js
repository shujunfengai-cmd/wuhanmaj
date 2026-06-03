const Tile = require('./tile');
const Rules = require('./rules');

class Deck {
  constructor() {
    this.allTiles = Tile.shuffle(Tile.createDeck());
    this.wall = this.allTiles.slice();
    this.doraIndicator = null;
    this.laizi = null;
    this.piZi = [];
    this.deadWall = [];
  }

  // 掷骰子（两个骰子，2-12）
  rollDice() {
    return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
  }

  // 定庄家：东风位首轮为庄家（简化：随机或按座位）
  // 实际由 engine 决定，这里只负责发牌相关

  // 翻赖子/皮子：从牌墙末尾翻牌
  revealLaizi() {
    if (this.wall.length === 0) return;
    // 从末尾翻一张
    const flipped = this.wall.pop();
    this.doraIndicator = flipped;
    const result = Rules.computeLaiziAndPiZi(flipped);
    this.laizi = result.laizi;
    this.piZi = result.piZi;
    return { flipped, laizi: this.laizi, piZi: this.piZi };
  }

  // 发牌：每人13张，庄家14张
  deal(playersCount = 4) {
    const hands = [];
    for (let i = 0; i < playersCount; i++) {
      hands.push([]);
    }
    // 每人先发12张（4轮，每轮3张）
    for (let round = 0; round < 4; round++) {
      for (let p = 0; p < playersCount; p++) {
        for (let c = 0; c < 3; c++) {
          if (this.wall.length > 0) hands[p].push(this.wall.pop());
        }
      }
    }
    // 再每人1张（庄家会额外再摸一张）
    for (let p = 0; p < playersCount; p++) {
      if (this.wall.length > 0) hands[p].push(this.wall.pop());
    }
    // 庄家（0号位）再摸一张
    if (this.wall.length > 0) hands[0].push(this.wall.pop());

    // 排序
    for (const hand of hands) {
      hand.sort(Tile.tileSortCompare);
    }
    return hands;
  }

  // 摸牌
  draw() {
    if (this.wall.length === 0) return null;
    return this.wall.pop();
  }

  // 剩余牌数
  remaining() {
    return this.wall.length;
  }
}

module.exports = Deck;
