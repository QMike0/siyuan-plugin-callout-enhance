fetch("https://cdn.jsdelivr.net/gh/siyuan-note/appearance@master/icons/material/icon.js")
  .then((r) => r.text())
  .then((c) => {
    for (const id of ["iconInfo", "iconFile", "iconEdit", "iconSiYuan"]) {
      const m = c.match(new RegExp(`<symbol[^>]*id="${id}"[^>]*>[\\s\\S]*?</symbol>`));
      console.log("\n===", id, "===");
      console.log(m ? m[0].slice(0, 400) : "missing");
    }
  });
