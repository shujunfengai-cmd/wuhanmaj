# 武汉麻将（公网版）

四人实时对战武汉麻将，支持口令房间、公网分享、历史积分。

## 本地运行

1. 安装 Node.js 18+
2. 安装依赖：`npm install`
3. 启动：`npm start`
4. 访问：`http://localhost:3000`

## 部署到 Render

1. 推送代码到 GitHub
2. Render Dashboard -> New Web Service -> 连接 GitHub 仓库
3. Start Command: `node server.js`
4. 自动部署，获得公网链接

## 游戏规则

- 皮子：翻出本张、上一张、红中为皮子；翻到红中时额外加西为皮子
- 赖子：翻出下一张；红中不能是赖子
- 皮子持有不能胡，打出皮子算杠即时+1分（不算开口）
- 开口：吃/碰/明杠算开口，暗杠/皮子杠不算开口
- 明杠/暗杠胡牌时每个+1番，无即时积分
- 无七对，碰碰胡3番，清一色3番

## 技术栈

Node.js + Express + Socket.io + SQLite
