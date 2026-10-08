![sync](https://github.com/viazure/douban-backup/actions/workflows/sync.yml/badge.svg)

定时把豆瓣 RSS、Bangumi 收藏同步到 NeoDB（可选：Notion、Douban→Bangumi）。Fork 自 [bambooom/douban-backup](https://github.com/bambooom/douban-backup)；上游 Notion 教程见 [博文](https://zhuzi.dev/posts/2021-06-05-douban-backup-sync-notion/)，导出可用 [油猴脚本](https://greasyfork.org/en/scripts/420999)。

```
.
├── .github/workflows   # sync.yml（默认每 6 小时）
├── src                 # 同步脚本
├── scripts             # 偶用脚本
├── userscript          # 豆瓣导出油猴脚本
├── cols.json           # Notion 列名（仅 Notion 路径）
└── archive             # 废弃实验代码
```

本地：`cp .env.example .env`，填 secrets，然后 `npm ci` / `npm run sync`。Actions 运行记录：[sync workflow](https://github.com/viazure/douban-backup/actions/workflows/sync.yml)。

豆瓣 RSS 每次大约只保留最近 10 条（含想\*）。Douban→NeoDB / Douban→Bangumi 会处理想/在/过；Douban→Notion 只处理看过/听过/读过等 Complete。集中标记过多时可能漏同步，可手动触发 workflow 或把 cron 改密。

## 同步路径开关

每条链路可独立开关（环境变量 / GitHub Actions repository variables）：

| Variable              | 默认 | 说明                 |
| --------------------- | ---- | -------------------- |
| `SYNC_DOUBAN_NOTION`  | `0`  | 豆瓣 RSS → Notion    |
| `SYNC_DOUBAN_NEODB`   | `1`  | 豆瓣 RSS → NeoDB     |
| `SYNC_DOUBAN_BANGUMI` | `1`  | 豆瓣 RSS → Bangumi   |
| `SYNC_BANGUMI_NEODB`  | `1`  | Bangumi 收藏 → NeoDB |

取值为 `1` / `true` / `on` 启用，`0` / `false` / `off` 关闭。关闭全部 `Douban→*` 时会跳过拉取豆瓣 RSS。

### 按类别过滤

每条链路可再设类别白名单（逗号分隔）。**留空 = 该链路同步全部类别**。

| Variable                         | 词表                                         | 说明            |
| -------------------------------- | -------------------------------------------- | --------------- |
| `SYNC_DOUBAN_NOTION_CATEGORIES`  | `movie` `music` `book` `game` `drama`        | 豆瓣 → Notion   |
| `SYNC_DOUBAN_NEODB_CATEGORIES`   | 同上                                         | 豆瓣 → NeoDB    |
| `SYNC_DOUBAN_BANGUMI_CATEGORIES` | 同上                                         | 豆瓣 → Bangumi  |
| `SYNC_BANGUMI_NEODB_CATEGORIES`  | `anime` `manga` `book` `music` `game` `real` | Bangumi → NeoDB |

也接受中文别名（如 `电影`、`动画`/`动漫`、`漫画`、`游戏`）。豆瓣词表对应 RSS 解析出的类别；Bangumi 词表对应条目类型（`manga` = 书籍且 `platform` 为「漫画」，不含小说/画集；`book` = 全部书籍）。

若写了值但没有可识别的类别，该链路**不同步任何条目**（避免拼写错误变成全量），日志会警告。

```env
SYNC_DOUBAN_NOTION=0
SYNC_DOUBAN_NEODB=1
SYNC_DOUBAN_BANGUMI=1
SYNC_BANGUMI_NEODB=1
SYNC_BANGUMI_NEODB_CATEGORIES=anime,manga,game
```

若 Actions 拉豆瓣 RSS 出现超时 / `403` / `401`，多半是豆瓣拦机房 IP。脚本已带浏览器 UA 并有限重试；仍失败可设 `DOUBAN_RSS_USER_AGENT`，或暂时只开 `SYNC_BANGUMI_NEODB`（豆瓣失败时 Bangumi→NeoDB 仍会继续，但 workflow 以非 0 退出）。

## 同步到 NeoDB

> [NeoDB 文档](https://neodb.social/developer/)

在文档页生成 Token，添加 secret `NEODB_API_TOKEN`。需开启 `SYNC_DOUBAN_NEODB` 和/或 `SYNC_BANGUMI_NEODB`（默认均开）才会写入。

可选 `NEODB_VISIBILITY`（`.env` 或 repository variable）：

| 值  | 含义                       |
| --- | -------------------------- |
| `0` | 公开                       |
| `1` | 仅关注者                   |
| `2` | 自己和提到的人（**默认**） |

写入 mark 时带上该值；与 NeoDB 已有可见性不同则会更新。

### 标记合并策略

作用于 Douban→NeoDB、Bangumi→NeoDB。NeoDB **没有**该条标记时，用来源全量写入（可带标记时间）。**已有**标记时：

- 状态：以来源为准（Douban→NeoDB 若 NeoDB 已是 `dropped` 则整条不更新 mark）
- 评分 / 短评：由下方 profile 决定
- 标记时间：更新时不改写 NeoDB 已有 `created_time`
- 进度：见 `SYNC_BANGUMI_NEODB_PROGRESS`（默认关闭，不在 merge profile 内）

| Variable                   | 默认           | 说明            |
| -------------------------- | -------------- | --------------- |
| `SYNC_DOUBAN_NEODB_MERGE`  | `neodb_prefer` | 豆瓣 → NeoDB    |
| `SYNC_BANGUMI_NEODB_MERGE` | `neodb_prefer` | Bangumi → NeoDB |

| 值             | 评分 / 短评                                        |
| -------------- | -------------------------------------------------- |
| `neodb_prefer` | NeoDB 已有非 0 评分 / 非空短评则保留，否则用来源填 |
| `overwrite`    | 用来源覆盖评分与短评                               |

```env
SYNC_DOUBAN_NEODB_MERGE=neodb_prefer
SYNC_BANGUMI_NEODB_MERGE=neodb_prefer
```

## 同步到 Bangumi（Douban → Bangumi）

> [Bangumi API](https://bangumi.github.io/api/)

1. 打开 [个人令牌页面](https://next.bgm.tv/demo/access-token) 创建 Access Token（尽量选最长有效期；无永久选项）。
2. 添加 secret：`BANGUMI_ACCESS_TOKEN`。
3. 保持 `SYNC_DOUBAN_BANGUMI=1`（默认已开）。

可选：`BANGUMI_PRIVATE`（默认 `false`）、`BANGUMI_USER_AGENT`。

**Token 会过期**：无 refresh，到期需重新生成并更新 secret。日志出现 401 /「token 可能已过期」即此原因。详见 [个人令牌说明](https://bgm.tv/group/topic/370315)。

匹配：优先 NeoDB `external_resources` 上的 Bangumi 链接，否则标题精确搜索。豆瓣「话剧」仅在 NeoDB 已挂 Bangumi 链接时同步。Bangumi 无法写入标记时间。覆盖类型：书籍、动画/三次元影视、音乐、游戏。若 Bangumi 已是搁置/抛弃，Douban→Bangumi 不覆盖。

## Bangumi → NeoDB

同时配置 `BANGUMI_ACCESS_TOKEN` 与 `NEODB_API_TOKEN`，且 `SYNC_BANGUMI_NEODB=1` 时，定时任务拉取最近一批 Bangumi 收藏（默认 50，可用 `BANGUMI_COLLECTION_LIMIT`，最大 50）同步到 NeoDB。评分/短评按 `SYNC_BANGUMI_NEODB_MERGE` 合并。

状态映射：想看→wishlist，在看→progress，看过→complete，搁置→progress，抛弃→dropped。

进度（章节/集数等）默认**不同步**。若需要，设 `SYNC_BANGUMI_NEODB_PROGRESS=1`：来自收藏的 `ep_status` / `vol_status`——动画/三次元剧集→`episode`（NeoDB 分类为 `movie` 的不写 episode），书籍优先 `vol_status` 否则 `ep_status`→`chapter`，音乐→`track`；游戏不同步；为 0 不写也不删。Douban→NeoDB 从不写 progress。

重复条目：同一作品可能有豆瓣源 / Bangumi 源两个 catalog。Bangumi→NeoDB 优先写到带豆瓣外链的那条（与 Douban→NeoDB 共用 uuid）。对不上时可能各标一条；可手动删 Bangumi 源标记后再同步。

全量（不要放进默认 cron）：

```bash
npm run sync:bangumi-full
```

只跑 Bangumi→NeoDB，不拉豆瓣、不改 Bangumi。也可设 `BANGUMI_FULL_SYNC=1` 后执行 `npm run sync`（先跑已开启的 Douban→*，再全量 Bangumi→NeoDB）。

## Notion（可选）

默认关闭。开启 `SYNC_DOUBAN_NOTION=1` 并配置 `NOTION_TOKEN` 与各分类 database id（见 `.env.example`）。列名见 `cols.json`。仅同步 Complete 状态；海报使用豆瓣图片 URL，Notion 内显示可能不稳定。更细的建库步骤见上游[博文](https://zhuzi.dev/posts/2021-06-05-douban-backup-sync-notion/)。
