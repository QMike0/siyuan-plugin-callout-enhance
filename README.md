# SiYuan Callout Enhance Plugin

[简体中文](https://github.com/QMike0/siyuan-plugin-callout-enhance/blob/main/README_zh_CN.md)

> [!important]
>
> In addition to the five native callout types in SiYuan, this plugin adds several new styles. Please note that when these new styles are converted back to official callouts (i.e., when this plugin is disabled), there will be display issues: they will become callout blocks with transparent backgrounds and missing icons. Use with caution if you mind this!

## Main Features

> For more details, please refer to [here](https://github.com/QMike0/siyuan-plugin-callout-enhance/tree/main/assets/TESTITEM.md).

#### (1) Callout Style Optimization

Basic styles:

![callout_type](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/callout_type.png)

After nesting:

![callout_nesting](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/callout_nesting.png)

#### (2) Quick Title Editing

![title_editing](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/title_editing.gif)

#### (3) Quick Fold/Unfold

![fold&unfold](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/fold%26unfold.gif)

#### (4) Completion Menu

- Press `[` or `【` at the beginning of the first line of a quote block to to trigger the completion menu.
- Supports using the keyboard to switch or the mouse to click and select a type.
- Supports auto-completion. Note: You do not need to type `!` after `[` / `【`; just type letters to trigger completion.

![completion_menu](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/completion_menu.gif)

#### (5) Type Menu

- Click the icon to call out the type menu.
- Supports using the keyboard to switch or the mouse to click and select a type.

![type_menu](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/type_menu.gif)

#### (6) Callout type management (settings)

Open **Settings → Callout Types** to add, disable, reorder, or edit custom types. Built-in SiYuan types (NOTE, TIP, etc.) cannot be renamed or deleted.

- **Rename label**: Existing blocks keep their old `data-subtype` until you run cleanup; the plugin still applies your style via *past labels* (not used in completion).
- **Delete type**: Blocks keep the old subtype but lose custom styling; the label is recorded in a *tombstone* list so you cannot accidentally reuse it without confirmation.
- **Clean up legacy data** (Settings → About → Purge): Merges past-label subtypes to each type’s current label, maps orphaned tombstone subtypes to NOTE, then clears past labels and the tombstone. Save all open documents first; keep SiYuan and the settings window open until it finishes.

## Changelog

See [CHANGELOG.md](https://cdn.jsdelivr.net/gh/QMike0/siyuan-plugin-callout-enhance@main/CHANGELOG.md)

## Development

Download the source code of this repository and package the plugin as follows:

1. Install Node.js and pnpm.
2. Run `pnpm i` in the current directory.
3. Run `pnpm run dev` for the development build.
4. Run `pnpm run build` to package `package.zip`.

## License

MIT License

## Acknowledgments

- Developed based on the [SiYuan plugin sample](https://github.com/siyuan-note/plugin-sample) template.
- Special thanks to [xqh042](https://github.com/wzj042) for the code snippets, which inspired this plugin.

## Other

For simple usage, you can also just base it on the code snippets [here](https://github.com/QMike0/Siyuan-ObsidianType-Callout) without adding this plugin.

**However, please note that the plugin has made many optimizations based on them. Unless there are special circumstances, the code snippets will not be updated in the future. Therefore, it is strongly recommended to use the plugin directly.**