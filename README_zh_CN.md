# 思源笔记 Callout 增强插件

[English](https://github.com/QMike0/siyuan-plugin-callout-enhance/blob/main/README.md)

> [!important]
>
> 本插件除了支持思源笔记内置的五种callout类型，还可另外自定义新样式。需要注意新样式在转换回官方 callout 后（即关闭本插件）存在显示上的问题，会变成背景透明、ICON 消失的 callout。介意的话慎用！

## 主要特性

> 若想了解更多细节，请参考[这里](https://github.com/QMike0/siyuan-plugin-callout-enhance/tree/main/assets/TESTITEM_zh_CN.md)

### （1）Callout外观优化

默认外观：

![callout_type](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/callout_type.png)

嵌套后：

![callout_nesting](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/callout_nesting.png)



### （2）标题快速编辑

![title_editing](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/title_editing.gif)

### （3）快速折叠/展开

![fold&unfold](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/fold%26unfold.gif)

### （4）补全菜单

-  引述块首行的开头处输入`[`/`【` 唤出补全菜单
-  支持键盘切换或鼠标点击选择类型
- 支持自动补全。注意`[`/`【`后无需输入`!`，直接输入字母即可触发补全

![completion_menu](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/completion_menu.gif)

### （5）类型菜单

- 点击icon唤出类型菜单
- 支持键盘切换或鼠标点击选择类型

![type_menu](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/type_menu.gif)

### （6）设置项：Callout外观自定义

- 可在「设置-外观」中自定义 Callout 外观，并支持保存、管理外观预设及实时预览样式

- 例如仿照Github Callout自定义外观：

  ![PixPin_2026-06-02_00-02-02](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/PixPin_2026-06-02_00-02-02.gif)

### （7）设置项：Callout 类型管理

- 可在「设置-Callout类型」中新增、删除、禁用、排序与编辑Callout类型。注意思源笔记内置的五种callout类型（NOTE、TIP 等）不支持删除

  ![PixPin_2026-06-02_00-53-281](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/PixPin_2026-06-02_00-53-281.gif)

- callout样式编辑弹窗中支持自定义callout的标签、关键词、主色与icon，并在编辑过程中提供实时预览

  ![PixPin_2026-06-02_00-57-411](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/PixPin_2026-06-02_00-57-411.gif)
  

### （8）设置项：其他

- 「设置-关于-清理历史数据」：在说明该功能前，需理解「设置-Callout 类型」的如下两个操作带来的影响：

  - **重命名“标签”**：笔记文档中的callout块仍保留旧 `data-subtype`，因此插件将重命名前的旧 *标签* 被自动保存为 *历史标签*  ，从而为对应callout块继续匹配样式
  - **删除callout类型**：笔记文档中的对应callout块保留原 `data-subtype`，回退到默认样式（NOTE样式）；被删除callout类型的 *标签* 与 *历史标签* 被记入*墓碑*

  **清理历史数据**的目的是迁移笔记文档中的callout块的 `data-subtype`至新标签或 NOTE 标签，从而安全地清空 *历史标签* 与 *墓碑* 

- 「设置-关于-调试日志」：在思源笔记控制台显示插件详细DEBUG日志

## 更新日志

见[CHANGELOG.md](https://cdn.jsdelivr.net/gh/QMike0/siyuan-plugin-callout-enhance@main/CHANGELOG.md)

## 开发相关

下载本仓库源码，按照如下方式打包插件：

1. 安装 Node.js 和 pnpm。
2. 在当前目录执行 `pnpm i`。
3. 执行 `pnpm run dev` 进行开发构建。
4. 执行 `pnpm run build` 打包 `package.zip`。

## 许可证

MIT License

## 致谢

- 基于 [SiYuan plugin sample](https://github.com/siyuan-note/plugin-sample) 模板开发
- 特别感谢[xqh042](https://github.com/wzj042)提供的代码片段，本插件源于此
- 「[obsidian-callout-manager](https://github.com/eth-p/obsidian-callout-manager)」：参考了其实现的Callout类型管理
- 「[sy-bookmark-plus](https://github.com/frostime/sy-bookmark-plus)」：参考了其实现的icon筛选界面
- 「[syplugin-hierarchyNavigate](https://github.com/OpaqueGlass/syplugin-hierarchyNavigate)」：参考了其实现的类型条目拖动

## 其他

简单使用也可仅基于[这里](https://github.com/QMike0/Siyuan-ObsidianType-Callout)的代码片段，而无需添加本插件。

**但注意本插件已在其基础上做了超级多优化，后续无特殊情况不再更新代码片段，因此强烈建议直接使用插件**！
