> *Please pay special attention to behavior in nested blocks. The state where the callout body is empty and contains only one empty line is referred to as an "empty callout".*

## 1. Title editing area
- Single-click in the title area: the cursor is placed correctly, and the type menu or fold/unfold button is not triggered accidentally.
- Pressing Enter in the title area:
  - When the callout is expanded: a new block is created on the first line of the body area.
  - When the callout is folded: a new block is created below the callout block without expanding the callout.
- Text input in the title area:
  - Input works correctly with Chinese IME.
  - The title text is saved correctly after the title area loses focus.
  - Toolbar is not triggered by shortcut keys.
  - Ctrl+A selects only the title area instead of the entire callout block.
  - The title area keeps plain text only and does not preserve rich-text formatting.
- Pasting into the title area:
  - Pasting plain text works correctly.
  - Pasting formatted text is correctly converted to plain text.
  - Pasting does not break the callout title structure.
- Undo/redo:
  - Title text input supports undo/redo.
  - Title text paste supports undo/redo.
  - New blocks created by pressing Enter in the title area support undo/redo.
- Persistence:
  - The modified title is still kept after reloading the page or closing and reopening the tab.
- Empty callout behavior:
  - Editing/pasting in the title area does not make the callout body disappear.

## 2. Fold/unfold functionality
- Normal folding:
  - Clicking the button smoothly folds the body area.
  - The arrow rotates in sync.
  - The body area does not suddenly disappear, flash back, or leave blank residue.
  - The position of the icon/title/button after folding is correct.
- Normal unfolding:
  - Clicking the button smoothly unfolds the body area.
  - The arrow rotates in sync.
  - The body area does not suddenly appear or flash back.
  - After unfolding completes, newly added body lines continue to increase the callout height.
- Reverse click during animation:
  - If folding is not finished and the user switches to unfolding, the callout unfolds smoothly from the current height.
  - If unfolding is not finished and the user switches to folding, the callout folds smoothly from the current height.
  - The button state and body state do not become inconsistent.
  - The body height is not stuck at a fixed value.
- Rapid repeated clicks on the fold/unfold button:
  - After multiple rapid clicks, the final state matches the last click.
  - The fold/unfold animation matches the last click.
  - The body height is not stuck at a fixed value.
- Undo/redo:
  - Folding/unfolding state supports undo/redo.
- Persistence:
  - The fold/unfold state is still kept after reloading the page or closing and reopening the tab.
- Other:
  - No temporary styles or temporary attributes are written into the document.
  - Closing or reloading the page during animation should not cause the fold state to become stuck or abnormal on the next open.
  - Temporarily increasing `--callout-fold-duration` (for example, to 1000ms) and retesting should not expose blank areas, flashes, rebound, clipping, or desynchronization issues.

## 3. Body input and editing
- Normal body input:
  - New body blocks can still be entered normally.
  - The callout height changes together with body content while typing.
  - In the unfolded state, the bottom content is not clipped.
- Pressing Enter in the body area:
  - Pressing Enter in the body creates new blocks normally.
  - Pressing Enter on an empty non-tail line can create a new block and supports undo/redo.
- Arrow keys at the body boundary:
  - When the cursor is at the far left of the body, pressing ArrowLeft returns to the title.
  - The cursor does not get lost or stuck.
- Undo/redo:
  - Changes in the body area support undo/redo.
- Persistence:
  - The modified body is still kept after reloading the page or closing and reopening the tab.
- Empty callout behavior:
  - Pressing Enter can delete an empty callout and supports undo/redo; pay special attention to empty callouts inside nested blocks.

## 4. Type menu functionality
- Opening the type menu:
  - Clicking the icon opens the menu.
  - The menu is displayed as completely as possible.
  - The menu closes automatically when it loses focus.
- Selecting a type with the mouse:
  - Clicking a menu item switches the type.
  - The icon / background color / title color change accordingly.
  - The body content is not affected.
- Selecting a type with the keyboard:
  - ArrowUp / ArrowDown switch menu items.
  - Home / End jump to the first / last item.
  - Enter / Tab confirm the selected type.
  - Escape closes the menu.
- Undo/redo:
  - Switching the callout type supports undo/redo.
- Persistence:
  - The changed callout type is still kept after reloading the page or closing and reopening the tab.
- Other:
  - No temporary styles or temporary attributes are written into the document.

## 5. Completion menu functionality
- Opening the completion menu:
  - The menu appears only when typing a bracket at the beginning of the first line of a quoted block.
  - Both Chinese and English brackets are supported.
  - The menu closes automatically when it loses focus.
- Auto-completion:
  - Typing one or more letters after the bracket filters the corresponding callout types.
- Selecting a type with the mouse:
  - Click the menu item to select the type, and automatically convert the quote block into a callout.
  - The icon / background color / title color change accordingly.
  - The body content is not affected.
- Selecting a type with the keyboard:
  - ArrowUp / ArrowDown switch menu items.
  - Home / End jump to the first / last item.
  - Enter / Tab confirm the selected type, and automatically convert the quote block to a callout.
  - Escape closes the menu.
- Undo/redo:
  - Converting a quoted block can be undone.
  - Redo from a quoted block back to a callout block is also supported.
- Persistence:
  - The selected callout type is still kept after reloading the page or closing and reopening the tab.
- Other:
  - No temporary styles or temporary attributes are written into the document.

## 6. Layout compatibility
- Callout in a normal paragraph:
  - The callout width is correct.
  - The border and title frame are positioned correctly.
- Callout inside a list item:
  - The callout width is correct inside the list.
  - Folding/unfolding works correctly.
  - The border and title frame are positioned correctly.
- Callout inside a horizontal super block:
  - It is not stretched or centered in the horizontal layout.
  - The width and height are as expected after folding/unfolding.
- Nested callout / nested body blocks:
  - Folding is stable when blocks are nested inside a callout.
  - The callout can be unfolded normally after folding.

## 7. Image / PDF / HTML export
- Exported HTML / PDF / images keep the customized callout styles.
- The fold/unfold button does not appear in the exported result.
- The fold/unfold button does not appear in the export preview.
- The callout appearance in PDF / image preview matches the final PDF / image output.

## 8. Switching between the plugin and native callout
- The plugin switch can control switching between native callout and plugin callout.
- Native callout and plugin callout can correctly recognize each other’s fold/unfold state.
- Native callout and plugin callout can correctly recognize each other’s type (excluding custom types).

## 9. Type rename / delete / cleanup (v0.2.3+)

- Rename (before cleanup):
  - After changing the label in settings, historical labels appear in the list; blocks with the old subtype still use plugin styling
  - The completion menu does not list historical names; the type menu writes the current label
- Delete:
  - The confirm dialog shows an “at least N blocks” count (open/indexed notebooks)
  - After confirm, the type is removed; blocks fall back to the default SiYuan callout style with the same subtype
  - Creating the same label again triggers the tombstone prompt with “Save and apply style”
- Cleanup (About → Clean up legacy data):
  - Prompts to save open documents; read-only workspace should be rejected
  - Phase A: merge historical subtypes to each type’s current label (`data-subtype` and `[!LABEL]`)
  - Phase B: merge tombstone orphans to NOTE
  - Historical labels and tombstone are cleared when done; cancel or closing settings should abort
  - Unsaved Callout Types edits in the settings dialog should be included in cleanup
- Closed notebooks:
  - If legacy blocks exist only in closed notebooks, cleanup should open them temporarily and close them afterward

## 10. Stability and pollution checks
- After folding/unfolding, switching types, and editing the title, check whether any temporary styles remain in the DOM.
- The following should not remain:
  - `height`
  - `overflow`
  - `transition`
  - `will-change`
  - `max-height`
  - `margin-top`
  - `margin-bottom`
  - `flex-shrink`
- Reloading the page during animation should not cause abnormal states.
- After reloading, the callout type, title, and fold/unfold state should remain consistent with the state before reload.
