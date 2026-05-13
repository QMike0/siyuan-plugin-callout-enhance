# 思源笔记 Callout 增强插件

[English](https://github.com/QMike0/siyuan-plugin-callout-enhance/blob/main/README.md)

> [!important]
>
> 本插件除了支持思源笔记原生的五种callout类型，还另外增加了几个新样式。需要注意新样式在转换回官方 callout 后（即关闭本插件）存在显示上的问题，会变成背景透明、ICON 消失的 callout。介意的话慎用！

## 主要特性

#### （1）Callout样式优化

基础样式：

![callout_type](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/callout_type.png)

嵌套后：

![callout_nesting](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/callout_nesting.png)



#### （2）标题快速编辑

![title_editing](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/title_editing.gif)

#### （3）快速折叠/展开

![fold&unfold](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/fold%26unfold.gif)

#### （4）补全菜单

-  引述块首行的开头处输入`[`/`【` 唤出补全菜单
-  支持键盘切换或鼠标点击选择类型
- 支持自动补全。注意`[`/`【`后无需输入`!`，直接输入字母即可触发补全

![completion_menu](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/completion_menu.gif)

#### （5）类型菜单

- 点击icon唤出类型菜单
- 支持键盘切换或鼠标点击选择类型

![type_menu](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/type_menu.gif)

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

## 其他

简单使用也可仅基于[这里](https://github.com/QMike0/Siyuan-ObsidianType-Callout)的代码片段，而无需添加本插件。

**但注意插件已在其基础上做了许多优化，后续无特殊情况不再更新代码片段，因此强烈建议直接使用插件**
