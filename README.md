# douban-backup

[![sync](https://github.com/viazure/douban-backup/actions/workflows/sync.yml/badge.svg)](https://github.com/viazure/douban-backup/actions/workflows/sync.yml)

定时把豆瓣和 Bangumi 的收藏同步到 NeoDB，也可以选择同步到 Bangumi 或 Notion。默认在 GitHub Actions 中每 6 小时运行一次。

> Fork 自 [bambooom/douban-backup](https://github.com/bambooom/douban-backup)。

## 概述

```text
豆瓣 RSS ──→ NeoDB
         ├─→ Bangumi
         └─→ Notion

Bangumi 收藏 ──→ NeoDB
```

| 路线 | 默认 | 状态范围 |
| ---- | ---- | -------- |
| 豆瓣 → NeoDB | 开 | 想 / 在 / 过 |
| 豆瓣 → Bangumi | 开 | 想 / 在 / 过 |
| Bangumi → NeoDB | 开 | 含搁置 / 抛弃 |
| 豆瓣 → Notion | 关 | 仅 Complete（看过 / 听过 / 读过等） |

## 快速开始

### 1. Fork 并启用 Actions

1. Fork 本仓库。
2. 打开 **Actions**，如有提示则启用 workflows。
3. 后续配置都在你自己的 Fork 里完成。

Token 等敏感信息请放到 **Secrets**，不要写进代码或公开 Variables。

### 2. 准备凭证

| 凭证 | 获取方式 | 用途 |
| ---- | -------- | ---- |
| 豆瓣用户 ID | 主页 `https://www.douban.com/people/<id>/` 中的 `<id>` | 所有豆瓣 → \* |
| NeoDB Token | [开发者页面](https://neodb.social/developer/) | 写入 NeoDB |
| Bangumi Access Token | [个人令牌](https://next.bgm.tv/demo/access-token)（尽量选最长有效期） | 读写 Bangumi |

豆瓣收藏需能通过公开 RSS 读取。Bangumi Token 会过期，出现 `401` 时需重新生成。

### 3. 添加 Secrets

**Settings → Secrets and variables → Actions → Secrets**

| Secret | 说明 |
| ------ | ---- |
| `DOUBAN_USER_ID` | 豆瓣用户 ID |
| `NEODB_API_TOKEN` | NeoDB Token |
| `BANGUMI_ACCESS_TOKEN` | Bangumi Access Token |

默认三条路线只需以上三项。若启用 Notion，再加 `NOTION_TOKEN` 及对应 database id。

### 4. （可选）调整同步路线

**Settings → Secrets and variables → Actions → Variables**

| Variable | 默认 | 说明 |
| -------- | ---- | ---- |
| `SYNC_DOUBAN_NEODB` | `1` | 豆瓣 → NeoDB |
| `SYNC_DOUBAN_BANGUMI` | `1` | 豆瓣 → Bangumi |
| `SYNC_BANGUMI_NEODB` | `1` | Bangumi → NeoDB |
| `SYNC_DOUBAN_NOTION` | `0` | 豆瓣 → Notion |

`1` 开启，`0` 关闭。与默认相同的值不必创建。

### 5. 手动跑一次

**Actions → sync → Run workflow**，确认日志成功、目标账号结果无误后，即可依赖定时任务。

更多选项见 [配置](#配置)。

## 配置

Actions 使用 **Secrets**（敏感）与 **Variables**（开关等）；本地全部写在 `.env`（见 [`.env.example`](.env.example)）。映射见 [`.github/workflows/sync.yml`](.github/workflows/sync.yml)。

### 同步路线开关

| Variable | 默认 | 说明 |
| -------- | ---- | ---- |
| `SYNC_DOUBAN_NOTION` | `0` | 豆瓣 RSS → Notion |
| `SYNC_DOUBAN_NEODB` | `1` | 豆瓣 RSS → NeoDB |
| `SYNC_DOUBAN_BANGUMI` | `1` | 豆瓣 RSS → Bangumi |
| `SYNC_BANGUMI_NEODB` | `1` | Bangumi 收藏 → NeoDB |

布尔值：`1` / `true` / `yes` / `on` 为开。关闭全部豆瓣路线时不请求豆瓣 RSS。

### 按类别过滤

逗号或空格分隔；**留空 = 该路线全部类别**。

| Variable | 可用类别 | 说明 |
| -------- | -------- | ---- |
| `SYNC_DOUBAN_NOTION_CATEGORIES` | `movie` `music` `book` `game` `drama` | 豆瓣 → Notion |
| `SYNC_DOUBAN_NEODB_CATEGORIES` | 同上 | 豆瓣 → NeoDB |
| `SYNC_DOUBAN_BANGUMI_CATEGORIES` | 同上 | 豆瓣 → Bangumi |
| `SYNC_BANGUMI_NEODB_CATEGORIES` | `anime` `manga` `book` `music` `game` `real` | Bangumi → NeoDB |

支持中文别名：`电影`、`音乐`、`书籍`、`游戏`、`话剧`、`动画`、`动漫`、`漫画`、`三次元`。

Bangumi：`manga` = 书籍且 `platform` 为「漫画」；`book` = 全部书籍。非空但无可识别类别时该路线同步 0 条（避免拼写错误变全量）。

```env
SYNC_DOUBAN_NEODB_CATEGORIES=movie,book
SYNC_BANGUMI_NEODB_CATEGORIES=anime,manga,game
```

### NeoDB

Token 见 [开发者文档](https://neodb.social/developer/)，Secret：`NEODB_API_TOKEN`。

`NEODB_VISIBILITY`：

| 值 | 含义 |
| -- | ---- |
| `0` | 公开 |
| `1` | 仅关注者 |
| `2` | 自己和提到的人（默认） |

#### 标记合并

| Variable | 默认 | 路线 |
| -------- | ---- | ---- |
| `SYNC_DOUBAN_NEODB_MERGE` | `neodb_prefer` | 豆瓣 → NeoDB |
| `SYNC_BANGUMI_NEODB_MERGE` | `neodb_prefer` | Bangumi → NeoDB |

| 值 | 评分 / 短评 |
| -- | ----------- |
| `neodb_prefer` | NeoDB 已有非 0 评分 / 非空短评则保留，否则用来源填 |
| `overwrite` | 用来源覆盖 |

- 无标记时用来源创建。
- 状态以来源为准；豆瓣 → NeoDB 若已是 `dropped` 则不覆盖整条 mark。
- 更新时不改写 NeoDB `created_time`。
- Bangumi 无法提供可靠标记时间。

同一作品可能有豆瓣源 / Bangumi 源两个 catalog；优先写到带豆瓣外链的同介质条目。找 twin 不跨介质（书不会落到同名剧集）。对不上时可能各标一条。

### Bangumi

| Variable | 默认 | 说明 |
| -------- | ---- | ---- |
| `BANGUMI_PRIVATE` | `false` | 写入是否私密（须为 `true` 才开启） |
| `BANGUMI_COLLECTION_LIMIT` | `50` | 每类每批数量，最大 50 |
| `BANGUMI_USER_AGENT` | 内置 | 自定义 UA |

详见 [Bangumi API](https://bangumi.github.io/api/)、[个人令牌说明](https://bgm.tv/group/topic/370315)。

#### 豆瓣 → Bangumi

优先 NeoDB `external_resources` 里的 Bangumi 链接，否则标题精确搜索。覆盖书籍、动画/三次元、音乐、游戏；话剧仅在 NeoDB 已挂 Bangumi 时同步。Bangumi 已是搁置/抛弃时不覆盖。

#### Bangumi → NeoDB

| Bangumi | NeoDB |
| ------- | ----- |
| 想看等 | `wishlist` |
| 在看等 | `progress` |
| 看过等 | `complete` |
| 搁置 | `progress` |
| 抛弃 | `dropped` |

#### 进度

`SYNC_BANGUMI_NEODB_PROGRESS` 默认 `0`。设为 `1` 时：

- 动画/三次元：`ep_status` → `episode`（NeoDB `movie` 不写）
- 书籍：优先 `vol_status`，否则 `ep_status` → `chapter`
- 音乐：`ep_status` → `track`
- 游戏不同步；值为 0 不写也不清

#### 全量

```bash
npm run sync:bangumi-full
```

或临时 `BANGUMI_FULL_SYNC=1` 后 `npm run sync`。不要长期挂在 cron 上。

### Notion

默认关闭。开启 `SYNC_DOUBAN_NOTION=1`，配置 `NOTION_TOKEN` 与：

- `NOTION_MOVIE_DATABASE_ID`
- `NOTION_MUSIC_DATABASE_ID`
- `NOTION_BOOK_DATABASE_ID`
- `NOTION_GAME_DATABASE_ID`
- `NOTION_DRAMA_DATABASE_ID`

列名见 [`cols.json`](cols.json)。仅 Complete；海报用豆瓣图，Notion 内可能不稳定。建库可参考上游[博文](https://zhuzi.dev/posts/2021-06-05-douban-backup-sync-notion/)。

### 运行频率

[`.github/workflows/sync.yml`](.github/workflows/sync.yml) 默认：

```yaml
- cron: '0 */6 * * *'
```

GitHub schedule 可能延迟。日志与手动触发：**Actions → sync**。

豆瓣 RSS 可选 `DOUBAN_RSS_USER_AGENT`（机房 IP 被拦时）。

## 本地运行

需要 Node.js ≥ 20。

```bash
cp .env.example .env
npm ci
npm run sync
```

PowerShell：

```powershell
Copy-Item .env.example .env
npm ci
npm run sync
```

勿提交 `.env`。开发命令：`npm run typecheck` / `lint` / `format:check`。

```text
.
├── .github/workflows   # Actions
├── src                 # 同步逻辑
├── scripts             # 偶用脚本
├── userscript          # 豆瓣导出
├── cols.json           # Notion 列名
└── archive             # 废弃代码
```

导出也可用 [油猴脚本](https://greasyfork.org/en/scripts/420999)。

## 常见问题

**Actions 不自动跑？**  
确认已启用 workflows；长期无活动的公开仓库可能被暂停 schedule，重新启用即可。

**豆瓣超时 / `401` / `403`？**  
多为机房 IP 被拦，可重试或暂时只开 Bangumi → NeoDB。豆瓣失败时 workflow 仍可能以失败退出。

**Bangumi `401`？**  
重新生成并更新 Secret `BANGUMI_ACCESS_TOKEN`。

**NeoDB 标记删了又回来？**  
来源端仍有收藏时会重写；先改来源或关掉对应路线。

**豆瓣一次改很多条，部分没同步？**  
RSS 大约只保留最近 10 条，可分批改并手动触发。

## 已知限制

- 豆瓣 RSS 约最近 10 条，不适合历史全量。
- Actions IP 可能被豆瓣拦。
- Bangumi Token 会过期且无 refresh。
- 同作品可能多个 NeoDB catalog，只在同介质内合并。
- 单向同步：目标端删除不会反向删除来源。
