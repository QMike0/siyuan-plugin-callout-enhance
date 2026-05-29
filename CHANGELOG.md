## v0.2.3 2026-05-28

- 🇨🇳 Callout 类型支持重命名（historical label 保留旧样式解析）、删除（墓碑占用）与「关于 → 清理历史数据」全库合并
- 🇨🇳 设置：historical 只读展示、墓碑二次确认、删除前 SQL 计数提示；清理使用设置窗内未保存的类型草稿
- 🇨🇳 清理顺序：先 historical→当前 label，再墓碑孤儿→NOTE；支持取消、只读工作区拒绝、保存文档提示
- 🇺🇸 Callout types: rename with historical labels, delete with tombstone occupancy, and About → clean up legacy data
- 🇺🇸 Settings: read-only historical row, tombstone reclaim confirm, delete counts; cleanup respects unsaved type draft in the dialog
- 🇺🇸 Cleanup order: historical→label first, then tombstone orphans→NOTE; cancel, read-only guard, save-documents hint

## v0.2.2 2026-05-28

- 🇨🇳 简化折叠/展开的debug日志
- 🇨🇳 导出的图片/PDF/HTML中隐藏折叠/展开按钮
- 🇨🇳 增加测试清单TESTITME.md
- 🇨🇳 参考Obsidian callout配色进行修改
- 🇨🇳 增加插件设置；实现对整体外观自定义、callout类型条目的增加、删除、禁用、排序和样式编辑的设置
- 🇨🇳 补全菜单&类型菜单支持数字/中文搜索；优化补全菜单&类型菜单的初次显示与滚动体验
- 🇨🇳 优化细节
- 🇺🇸 Simplify the debug logs for collapsing/expanding
- 🇺🇸 Hide collapse/expand buttons in exported images/PDF/HTML
- 🇺🇸 Add test checklist TESTITME.md
- 🇺🇸 Modify by referencing Obsidian callout color scheme
- 🇺🇸 Add plugin settings; implement customization of overall appearance, and settings for adding, deleting, disabling, sorting, and style editing of callout type entries
- 🇺🇸 Support numeric/Chinese search in completion menu & type menu; optimize the initial display and scrolling experience of the completion menu & type menu
- 🇺🇸 Optimize details

## v0.2.1 2026-05-17

- 🇨🇳 修复callout标题区域能通过快捷键等方式唤出工具栏的问题
- 🇨🇳 优化callout标题区域的 Ctrl+A 操作，限制只能全选对应标题文字
- 🇨🇳 区分折叠/展开状态下的callout标题区域回车行为，现在折叠状态下的callout的标题区域回车行为改为在callout块下面新增块
- 🇨🇳 优化callout正文区域的 Enter 逻辑，将callout正文为空且仅一个空行时的 Enter 由模拟 Backspace 转为模拟原生callout的 Enter
- 🇨🇳 去除Asri主题中强制显示callout标题区域英文字母为大写形式的限制
- 🇨🇳 更换icon.png
- 🇨🇳 优化折叠/展开动画过程
- 🇺🇸 Fix the issue where the callout title area can invoke the toolbar via keyboard shortcuts or other methods
- 🇺🇸 Optimize the Ctrl+A operation in the callout title area to restrict it to only selecting the corresponding title text fully
- 🇺🇸 Differentiate the Enter key behavior in the callout title area between collapsed and expanded states. Currently, the Enter key behavior in the callout title area when collapsed is changed to create a new block below the callout block
- 🇺🇸 Optimize the Enter key logic in the callout body area, changing the Enter behavior when the callout body is empty with only one blank line from simulating Backspace to simulating native callout Enter
- 🇺🇸 Remove the restriction in the Asri theme that forces English letters in the callout title area to display in uppercase
- 🇺🇸 Replace icon.png
- 🇺🇸 Optimize the collapse/expand animation process

## v0.2.0 2026-05-15

- 🇨🇳 重构插件代码，拆分`index.ts`实现程序的模块化，并通过core、features、utils文件夹分别保存不同类型程序文件
- 🇨🇳 统一日志管理，由`index.ts`统一日志输出的开关
- 🇨🇳 优化代码逻辑
- 🇺🇸 Refactor the plugin code, split `index.ts` to achieve modularization, and use core, features, and utils folders to store different types of program files respectively
- 🇺🇸 Unify log management, with`index.ts` controlling the switch for unified log output
- 🇺🇸 Optimize code logic

## v0.1.2 2026-05-14

- 🇨🇳 放宽callout块的最大长度限制，避免超过限制后便不显示剩余内容
- 🇨🇳 放宽`waitForNativeEmptyCalloutHandling`时间限制
- 🇨🇳 优化callout标题的短时保存&撤回机制
- 🇨🇳 修复callout正文为空时，向标题粘贴文本会导致正文区域内容块消失的问题
- 🇨🇳 增加callout标题的输入清洗与内容规范化。确保callout标题区域粘贴/输入的都是纯文本，并对标题文字做到去除NBSP、去除零宽字符、折叠多余空白、去除首尾空白
- 🇺🇸 Relax the maximum length limit of callout blocks to prevent remaining content from being hidden after exceeding the limit
- 🇺🇸 Relax the time limit for `waitForNativeEmptyCalloutHandling`
- 🇺🇸 Optimize the short-term saving & undo mechanism for callout titles
- 🇺🇸 Fix the issue where pasting text into the title causes content blocks in the body area to disappear when the callout body is empty
- 🇺🇸 Add input sanitization and content normalization to ensure only plain text is entered in the callout title area
- 🇺🇸 Add input sanitization and content normalization for callout titles. Ensure that only plain text is pasted/entered into the callout title area, and apply the following to the title text: remove NBSP (non-breaking spaces), remove zero-width characters, collapse excess whitespace, and trim leading/trailing whitespace

## v0.1.1 2026-05-13

- 🇨🇳 优化代码逻辑，排除了一些潜在问题
- 🇨🇳 更改补全菜单的唤起逻辑：引述块首行的开头处输入[或【唤起补全菜单，不再判断引述块是否为空
- 🇺🇸 Optimize code logic and eliminate some potential issues
- 🇺🇸 Change the trigger logic of the completion menu: when typing [ or 【 at the beginning of the first line of a quote block, the completion menu will be triggered, without checking whether the quote block is empty.

## v0.1.0 2026-05-13

- 🇨🇳 将[代码片段](https://github.com/QMike0/Siyuan-ObsidianType-Callout)转换成本插件
- 🇨🇳 优化callout标题文字修改的保存机制
- 🇨🇳 优化callout标题处回车所插入块的撤回机制
- 🇨🇳 优化补全菜单&类型菜单的操作，支持方向键切换菜单项
- 🇨🇳 在代码片段的基础上进行代码逻辑优化与潜在问题排除
- 🇺🇸 Convert the [code snippet](https://github.com/QMike0/Siyuan-ObsidianType-Callout) into this plugin
- 🇺🇸 Optimize the saving mechanism for modifying callout title text
- 🇺🇸 Optimize the undo mechanism for blocks inserted when pressing Enter in the callout title
- 🇺🇸 Improve the operation of the completion menu & type menu, adding support for navigating menu items with arrow keys
- 🇺🇸 Refine the code logic and eliminate potential issues based on the code snippet

