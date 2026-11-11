# 主题简报仓库

用日期文件夹管理时间，用文件名管理对象，再用一个前端页面统一呈现格式。后来的事件接在同一对象的时间线后面，而不是每次另写一份互不相干的简报。

公开页面：[https://jalen-zhong.github.io/theme-briefs/](https://jalen-zhong.github.io/theme-briefs/)。也可以用浏览器直接打开 [`index.html`](index.html)，不必启动网站服务器。新增或修改条目之后，先运行下面的构建命令，再刷新页面。

每个对象页上方是时间线图：节点按时间从左到右排列，重要节点为红色。默认只看脉络；点击节点后，才在下方打开该时点的详细记录。从首页点某条标题，会直接打开对应对象的那个节点。

时区一律为 Asia/Shanghai（上海时间）。从 2026-11-11 起，例行简报改为每天上海时间 18:00 交一档（仓库里 11 月 10 日仍保留早间、晚间两档，作为历史记录）。页面底部注明：无仓位建议。

## 1. 目录约定

- 日期文件夹：`YYYY-MM-DD/`，按上海时间的日历日，不按 08:45 / 17:45 分文件夹。
- 对象文件：`YYYY-MM-DD/<对象编号>.json`，一个对象一天一个文件；同一天的早间、晚间条目写在该文件的 `entries` 数组里，用 `slot` 区分（如 `"08:45"`、`"17:45"`）。
- 对象名册：根目录 `objects.json`，记录编号、中文标题、类别、状态（`active` 或 `retired`）和一句话说明。
- 当日导语：`YYYY-MM-DD/_meta.json`，写入各档的标题、导语，以及可选的收束说明。
- 统一前端：`index.html`，样式和脚本在 `assets/`。`assets/bundle.js` 由构建脚本生成，把全部条目内嵌进页面，这样 `file://` 也能打开。
- 字段说明：`schema/entry.schema.json`。

## 2. 如何新增一天

1. 新建日期文件夹，例如 `2026-11-11/`（若已存在就直接用）。
2. 编写 `_meta.json`，写上当天各档的标题和导语。
3. **只为当天有更新、或仍在观察但需要续写一句的对象**新增或补充 JSON，不要把前一天的全文再贴一遍。
4. 在仓库根目录运行：

```bash
python3 tools/build.py
```

5. 重新打开或刷新 `index.html`。

## 3. 如何新增一个对象

1. 在 `objects.json` 里增加一条：`id`、`title_zh`、`category`、`status`、`summary`。
2. 在相应日期文件夹里创建 `<id>.json`，字段须符合 `schema/entry.schema.json`。
3. 运行 `python3 tools/build.py`。每个已经登记的对象，至少要有一个日期文件，否则构建会失败。

## 4. 如何标红重要内容

- 只有当天确实重要的进展，才把该条的 `important` 设为 `true`，例如：新的官方警告、官方数据公布、国会已完成宣誓、上市登记修订已经提交、独立董事聘请外部律师。日常的「仍未见新窗」「电子报价仍在跳动」应设为 `false`。
- `important_points` 只放少量短句，前端会把这些句子，以及重要条目的标题，标成红色（`#b00020`）。不要把整段公开记录都放进这个数组，也不要整段涂红。
- 若该条没有需要标红的短句，`important_points` 留空数组即可。

其他常用字段：

- `x_circulation`：简报里写到的网上流传。若该档没有写到 X 上的讨论，用空字符串 `""`。
- `public_record`：公开记录，忠实于已交简报，不编造。
- `sources`、`still_unseen`：只写简报里出现过的来源和「仍未见」事项，不要补写没有核对过的出处。

## 5. 公开页面

这一版已按要求公开到本仓库的 `main` 分支。GitHub Pages 从 `main` 的站点根目录提供页面：

https://jalen-zhong.github.io/theme-briefs/

`index.html` 使用相对路径加载 `assets/style.css`、`assets/bundle.js` 和 `assets/app.js`，因此在项目站点的子路径下可以打开，而不只在域名根目录。`assets/bundle.js` 已随仓库提交，访客不必在本地运行 Python。仓库根目录有一个空的 `.nojekyll`，让 Pages 按原样提供文件（包括各日期文件夹里的 `_meta.json`），不经过 Jekyll。

以后若改了条目，在仓库根目录运行 `python3 tools/build.py`，再把新的 `assets/bundle.js` 一并提交。
