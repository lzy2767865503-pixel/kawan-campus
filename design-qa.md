# Kawan Campus UKM · Design QA

## 2026-07-27 验收结果

- 首页只显示 UKM；旧的 UM、UPM、USM、Taylor’s、UCSI、Sunway 数据、组件和素材已移除。
- 六个板块使用不同但一致的颜色：活动、房间、闲置、约伴、拼车、汽车。
- 首页、内容流、社团权限入口、帖子详情和底部导航均完成中英文文案。
- 信息流只展示 D1 中的真实帖子，不再混入管理员无法下架的静态示例帖。
- 普通发布为单页流程，不需要公开账号系统。
- 所有分类的地点均为自由文本，并保留 UKM 常用地点建议；租房地址中的具体门牌号会由服务端拦截。
- 发布表单最多追加 12 张图片，逐张上传、逐张限制 5MB；详情页支持主图与缩略图切换。
- 活动发布显示社团账号与密钥验证；未验证时“确认发布”保持禁用。
- 社团密钥验证、7 天会话、已验证活动发布已通过本地端到端测试。
- 普通帖子发布、D1 持久化、公开联系方式展示和发布者删除权限已通过本地端到端测试；测试数据已删除。
- 首页与发布确认区均明确说明所有分类永久保留、不会自动过期；发布者主动删除与管理员下架/恢复边界保持清楚。
- 在线人数由真实 API 统计过去 3 分钟的活跃匿名会话；不可用时只回退为当前访问者，不生成随机数字。
- 桌面 1440×1000 和手机 390×844 已检查；手机页面无横向溢出，发布弹窗宽度与视口一致，底部导航可用。
- 浏览器检查未发现页面 console error 或 warning。
- Worker 测试覆盖静态资源、SPA 回退、绑定状态、无数据库空态、社团活动拦截、租房地址门牌号拦截、自由地址、多图顺序/清理和错误密钥。
- 企业管理后台已在桌面和手机断点检查；导航、搜索、状态过滤、分页、退出和六个管理模块均保持可用。
- 已完成真实浏览器联动：发布测试帖 → 后台一键下架 → 前台消失 → 后台恢复 → 前台重新显示。
- Worker 回归测试覆盖历史 `expires_at` 已过去的公开帖仍出现在信息流、可举报、媒体可访问并计入后台指标；定时任务只清理临时对象与限速窗口。
- 论文数据机器人与简历项目在桌面顶部、平板和手机底栏均作为一级导航直接显示，外链带 `noopener noreferrer`。

## 视觉对照

- 概念：首页密集但清晰的 UKM campus-today 信息架构。
- 实现：保留同样的深绿主色、彩色分类、精简后的社团权限入口、公开规则和真实校园主视觉。
- 概念：一页式发布与内联社团验证。
- 实现：桌面与手机均为单页动态表单；普通分类少字段，活动额外要求日期、地点和社团权限。

本轮发布前已核对桌面后台总览、手机后台总览和手机发布表单；截图只作为本地验收证据，不是运行时依赖。

## 2026-07-28 · 右侧栏删减 QA

### 对照基准

- Source visual truth: `docs/qa/2026-07-28/sidebar-before.png`
- Source pixels: 750 × 894；这是用户标注的桌面右侧栏裁切图，按 Retina 2× 归一为约 375 × 447 CSS px。
- Implementation full-view evidence: `docs/qa/2026-07-28/sidebar-after-desktop.png`
- Implementation mobile evidence: `docs/qa/2026-07-28/sidebar-after-mobile.png`
- Focused before/after evidence: `docs/qa/2026-07-28/sidebar-comparison.png`
- Desktop viewport / screenshot: 1440 × 1000 CSS px / 1440 × 1000 pixels，density 1×。
- Mobile viewport / full-page screenshot: 390 × 844 CSS px / 390 × 1888 pixels，density 1×。
- Focused comparison: 1280 × 720 pixels；原始裁切图按 375 × 447 展示，修改后的右侧栏使用 380 × 560 CSS px 视窗。
- State: 中文首页、真实帖子信息流、未打开弹窗；目标区域位于 `#discover`。

### Full-view comparison evidence

- “本周活动 / UKM EVENTS”与“UKM 热门区域 / AROUND CAMPUS”不再出现在页面 DOM 或可视右侧栏。
- 桌面端右侧只保留与运营流程直接相关的社团发布权限入口，主信息流、分类筛选、永久保留规则和发布 CTA 位置保持不变。
- 手机端页面宽度与视口同为 390 px，没有横向页面溢出；目标卡片不会在响应式布局中重新出现。

### Focused region comparison evidence

- 对照图左侧完整显示用户要求删除的两张卡片；右侧同一栏位只显示社团权限卡片，其余区域自然留白，没有残留边框、标题、编号或不可点击占位。
- 该区域没有需要单独检查的照片或插画；保留的盾牌和钥匙均继续使用项目现有图标库，清晰度与颜色未发生变化。

### Required fidelity surfaces

- Fonts and typography: 保留现有中文、英文和标题字体层级；删除卡片后没有孤立标题或异常换行。
- Spacing and layout rhythm: 桌面双栏对齐未变化；社团权限卡贴齐信息流顶部，移动端回落为单列。
- Colors and visual tokens: 深绿、浅绿、边框与按钮 token 保持一致，没有新增颜色。
- Image quality and asset fidelity: 用户要求删除的区域不需要替代图片；现有帖子图片和品牌素材没有改动。
- Copy and content: 四组目标文案（中英文标题与 eyebrow）均已从运行时和源代码移除；社团申请文案继续保留。

### Findings

- P0/P1/P2: none.
- P3: 当真实帖子数量很少时，桌面右栏在社团权限卡片下会有自然留白；这是删除两张卡片后的预期结果，不形成布局断裂，也不会阻塞内容浏览。

### Comparison history

- Pass 1: 删除两张卡片及其事件排序、区域筛选状态和专用 CSS 后完成 1440 × 1000 与 390 × 844 浏览器检查。
- Post-fix evidence: 目标文案检测为 false，右侧栏子元素数量为 1，桌面与手机均无横向溢出，浏览器 console error/warning 为 0。
- 本轮未发现需要二次修复的 P0/P1/P2 问题。

final result: passed

## 2026-07-28 · Hero 搜索区域疏密 QA

### 对照基准

- Source visual truth: `docs/qa/2026-07-28/hero-crowded-before.png`
- Source pixels: 2546 × 422；这是用户标注的 Retina 2× 桌面裁切图，归一为约 1273 × 211 CSS px。
- Implementation full-view evidence: `docs/qa/2026-07-28/hero-spacing-after-desktop.png`
- Implementation mobile evidence: `docs/qa/2026-07-28/hero-spacing-after-mobile.png`
- Focused before/after evidence: `docs/qa/2026-07-28/hero-spacing-comparison.png`
- Desktop viewport / screenshot: 1440 × 1000 CSS px / 1440 × 1000 pixels，density 1×。
- Mobile viewport / screenshot: 390 × 844 CSS px / 390 × 844 pixels，density 1×。
- Focused comparison: 1280 × 580 pixels；在同一画面展示用户标注区域与修改后对应区域。
- State: 中文首页、未打开弹窗、页面顶部 Hero 区域。

### Full-view comparison evidence

- 桌面端搜索框不再使用绝对定位压住 Hero 底边，而是在主文案与主视觉下方形成独立、居中的搜索行。
- 搜索框宽度为 780 px，Hero 宽度为 1240 px，占比 62.9%；搜索框完整位于 Hero 内部。
- Hero 与分类区之间保留 22 px 间距，搜索、Hero 与分类卡片不再互相叠压。
- 手机端搜索框位于主视觉之后并保留在 Hero 内部，宽 342 px、Hero 宽 368 px；页面宽度与视口同为 390 px，没有横向溢出。

### Focused region comparison evidence

- 对照图上方显示修改前搜索框接近整栏宽度并压住 Hero 底部；下方显示修改后搜索框成为独立居中的一行。
- 搜索框阴影同步减轻，视觉层级仍清晰，但不再产生悬浮遮挡感。
- 分类卡片与搜索框完全分离，用户可以按“主视觉 → 搜索 → 分类”的顺序阅读。

### Required fidelity surfaces

- Fonts and typography: 搜索占位文案、快捷键与 Hero 字体层级保持不变。
- Spacing and layout rhythm: 桌面端缩短搜索框并增加上下留白；手机端使用独立流式布局。
- Colors and visual tokens: 深绿、白色、边框与阴影 token 延续现有设计体系。
- Image quality and asset fidelity: Hero 校园照片和 UKM TODAY 卡片未替换、未拉伸、未降低清晰度。
- Copy and content: 中文、英文文案及搜索提示均未改动。

### Findings

- P0/P1/P2: none.
- P3: 手机端搜索框仍接近内容栏宽度，以保留足够的输入触控面积；其上下留白已与移动端节奏一致。

### Comparison history

- Pass 1: 将搜索框由绝对定位叠压改为 CSS Grid 中跨两列的独立行，并收窄为 Hero 的 62.9%。
- Post-fix evidence: 桌面端搜索框完整位于 Hero 内、分类区间距为 22 px；手机端无横向溢出；浏览器 console error/warning 为 0。
- 语言状态与搜索输入框保持可用；本轮未发现需要二次修复的 P0/P1/P2 问题。

final result: passed

## 2026-07-28 · 论文机器人与简历一级导航 QA

### 对照基准

- Source visual truth: `docs/qa/2026-07-28/nav-tools-before.png`
- Source pixels: 1018 × 400；这是用户标注的桌面导航与已展开“功能 · 2”菜单裁切图。
- Implementation desktop full-view evidence: `docs/qa/2026-07-28/nav-direct-after-desktop.png`
- Implementation focused header evidence: `docs/qa/2026-07-28/nav-direct-after-header.png`
- Implementation mobile evidence: `docs/qa/2026-07-28/nav-direct-after-mobile.png`
- Focused before/after evidence: `docs/qa/2026-07-28/nav-direct-comparison.png`
- Desktop viewport / screenshot: 1440 × 1000 CSS px / 1440 × 1000 pixels，density 1×。
- Focused header: 1440 × 120 CSS px / 1440 × 120 pixels，density 1×。
- Mobile viewport / screenshot: 390 × 844 CSS px / 390 × 844 pixels，density 1×。
- Focused comparison: 1200 × 830 pixels；在同一画面展示原下拉菜单与修改后一级导航。
- State: 中文首页、页面顶部；修改前“功能”菜单展开，修改后无二级菜单。

### Full-view comparison evidence

- 桌面端“校园动态、活动、论文机器人、简历”位于同一导航行；论文与简历入口不再需要展开菜单。
- 1440、1280 与 1081 px 宽度均无导航碰撞或横向溢出；1080 px 及以下自动切换到五项底部导航。
- 平板和手机底栏直接显示“动态、活动、发布、论文、简历”，补齐原 561–1080 px 没有主导航入口的断点缺口。
- 390 与 320 px 手机宽度均无横向溢出；五个入口触控高度为 54 px。

### Focused region comparison evidence

- 对照图上方显示两个项目隐藏在“功能 · 2”下拉卡片中；下方显示两个项目紧跟“校园动态、活动”直接排列。
- 论文机器人使用现有 `ClipboardCheck` 图标，简历使用现有 `FileText` 图标；图标尺寸、颜色与活动入口一致。
- 原下拉边框、阴影、数量徽章和展开箭头均已删除，没有遗留空白占位。

### Required fidelity surfaces

- Fonts and typography: 一级导航沿用现有 12.5 px、700 字重与中英文排版；手机使用简短中英文标签避免截断。
- Spacing and layout rhythm: 桌面导航项保持 18 px 间距；手机五栏等宽，发布入口仍保持中心强调。
- Colors and visual tokens: 继续使用现有深绿文字、绿色图标、白色页头与绿色发布按钮。
- Image quality and asset fidelity: 本次目标区域没有照片或插画；品牌标志与现有 Lucide 图标未替换、未变形。
- Copy and content: 桌面中文为“论文机器人 / 简历”，英文为“Thesis Robot / Resume”；完整项目名称保留在 `aria-label` 与 `title` 中。

### Interaction and accessibility evidence

- “活动”入口可切换到校园活动分类；“发布”入口可打开并关闭发布弹窗。
- 两个项目外链保持正确 URL、`target="_blank"` 与 `rel="noopener noreferrer"`。
- 中文和英文桌面导航均已检查；手机底栏五项均为直接按钮或链接，不再出现 `details` 菜单。
- 页面 console error / warning 为 0；键盘焦点继续使用全局 `focus-visible` 样式。

### Findings

- P0/P1/P2: none.
- P3: 平板底栏将五个入口限制在约 430 px 的居中区域，以保持手机式触控密度；这是断点切换后的预期布局。

### Comparison history

- Pass 1: 移除桌面与手机的“功能 · 2”二级菜单，把两个项目改为直接入口。
- Pass 1 responsive review: 发现原 561–1080 px 区间隐藏桌面导航但尚未显示手机导航；将五项底栏显示断点扩展至 1080 px。
- Post-fix evidence: 1081 px 显示无碰撞的桌面四项导航；1080 px 显示五项底栏；390 与 320 px 无横向溢出，触控高度 54 px。
- 本轮未发现需要继续修复的 P0/P1/P2 问题。

final result: passed
