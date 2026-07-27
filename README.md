# Kawan Campus UKM

Kawan Campus 是一个只服务 Universiti Kebangsaan Malaysia（UKM）的中英双语校园社区。学生可以发布房间、闲置物品、兴趣约伴、拼车和汽车买卖信息；活动只允许经过后台批准的 UKM 社团发布。

作者 / Author: **LAI ZEYU**

界面语言 / UI languages: **中文、English only**

## 已实现功能

- 无需注册的一页式学生发布流程，六个板块均提供真实填写示例。
- “功能 · 2”入口包含论文数据机器人与简历项目。
- 每个帖子最多 12 张 JPG、PNG 或 WebP 图片，每张最多 5 MB。
- 租房隐私规则、活动/拼车自动过期、30 天普通帖子有效期。
- 社团申请、一次性发布密钥、7 天社团会话、暂停/撤销/轮换权限。
- `/admin` 企业管理后台：总览、内容管理、举报审核、社团权限、平台设置、管理员与审计。
- 管理员一键下架后，帖子立即从公开信息流消失；恢复后重新公开。
- 管理员 8 小时安全会话、HttpOnly Cookie、同源校验、CSRF 防护、角色门禁、并发版本检查和不可由前端改写的审计记录。
- 仅保存密钥与会话令牌的 SHA-256 哈希；一次性社团密钥只在批准或轮换时返回一次。

## 技术结构

- React 19 + Vite 8
- Cloudflare Worker
- Cloudflare D1（帖子、图片索引、会话、举报、权限、审计和限速）
- Cloudflare R2（用户图片）
- Drizzle schema + 顺序 SQL migrations
- Node.js 22+ 与 npm lockfile

浏览器 `localStorage` 只保存界面语言、匿名在线会话 ID，以及发布者删除自己帖子的随机凭证。帖子与后台状态以 D1 为唯一数据源。

## 从零复刻

```bash
git clone https://github.com/lzy2767865503-pixel/kawan-campus.git
cd kawan-campus
npm ci
cp .env.example .dev.vars
npm run db:migrate:local
npm run check
npm run dev -- --host 127.0.0.1
```

打开首页后点击页脚“管理后台”，或访问 `/#admin`（标准 Worker 路由也支持 `/admin`）。把 `.dev.vars` 中的开发管理员邮箱与密钥填入登录页。`.dev.vars` 已被 Git 忽略，绝不能提交。

## 环境变量

| 名称 | 必需 | 用途 |
|---|---:|---|
| `KAWAN_ADMIN_EMAIL` | 是 | Owner 管理员登录邮箱 |
| `KAWAN_ADMIN_ACCESS_KEY` | 是 | 高强度后台访问密钥 |
| `UKM_CLUB_KEYS` | 迁移期可选 | 旧社团密钥哈希注册表；新社团由后台审批 |

生产环境应在托管平台的 secret/environment 管理界面配置变量。不要把真实值写入源码、Git、构建产物、截图或聊天。

生成本地开发密钥的示例：

```bash
openssl rand -base64 36
```

## 数据库

本地应用所有迁移：

```bash
npm run db:migrate:local
```

全新、自主管理的 Cloudflare D1 才可以执行：

```bash
npm run db:migrate:remote
```

已有 Sites 托管环境不要直接运行上面的命令。应先检查目标数据库的真实 schema 和 migration ledger，再由 Sites 的版本发布流程应用尚未执行的迁移，避免对已存在的表重复执行 `0000` 或 `0001`。

迁移按 `drizzle/0000_*`、`0001_*`、`0002_*` 顺序执行。修改 `db/schema.ts` 后运行 `npm run db:generate`；正常情况下，没有 schema 变化就不应生成重复迁移。

## 验证与部署前检查

```bash
npm run check
npm run deploy:dry-run
```

GitHub Actions 会在 push 和 pull request 时执行凭证模式扫描、空库迁移、Drizzle 一致性检查、测试、生产构建、Cloudflare dry-run 和依赖审计。生产部署还需要：

1. 绑定逻辑名称为 `DB` 的 D1 数据库。
2. 绑定逻辑名称为 `UPLOADS` 的 R2 bucket。
3. 配置管理员环境变量和可选旧社团注册表。
4. 全新自管 D1 先运行远程迁移；已有 Sites D1 使用其版本发布流程对齐迁移记录。
5. 部署与测试完全相同的 commit，并在生产环境重新验证后台登录、下架/恢复和社团停权。

Worker 每小时运行一次 scheduled cleanup，清理过期帖子、待上传对象和限速窗口。生产 R2 还应给 `posts/pending/` 前缀配置短期 lifecycle 自动删除，作为定时任务异常时的第二层保护。

## 安全与运营边界

- Kawan Campus 目前只服务 UKM，不表示 UKM 与平台存在合作、赞助、认可或官方背书。
- 电话、WhatsApp、微信或 Telegram 联系方式会公开展示；发布者必须确认这是其希望公开的联系方式。
- 租房内容不能包含门牌号、房号、身份证件或其他敏感资料。
- 平台不担保租房、商品或车辆交易；用户需要线下核验。
- 管理员“下架”是可恢复的软删除；发布者自己的删除仍是永久删除。
- 正式开放运营前，应指定举报 SLA、社团审核负责人和紧急内容升级流程。

## License

MIT © 2026 LAI ZEYU
