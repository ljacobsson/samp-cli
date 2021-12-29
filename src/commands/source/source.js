const inputUtil = require("../../shared/inputUtil");
const settingsUtil = require("../../shared/settingsUtil");

async function run(cmd) {
  const settings = {};
  console.log(`Set up new source repository.
  The repository should follow the following structure. (README.md is optional):
  ├── pattern-1
  | ├── README.md
  │ └── template.yaml
  ├── pattern-2
  | ├── README.md
  │ └── template.yaml
  └── pattern-3
    ├── README.md
    └── template.yaml
  `);
  settings.owner = await inputUtil.text("GitHub owner:");
  settings.repo = await inputUtil.text("GitHub repo:");
  settings.root = await inputUtil.text("Root folder:", "/");
  settings.relativePath = await inputUtil.text(
    "Relative path to template file:",
    "/"
  );
  settings.fileNames = (await inputUtil.text(
    "Template filename(s):",
    "template.yaml,template.yml"
  )).split(",").map(p=>p.trim());
  settings.url = await inputUtil.text("URL (use #PATTERN_NAME# as placeholder):", `https://github.com/${settings.owner}/${settings.repo}/tree/main${settings.root}#PATTERN_NAME#`);
  settingsUtil.savePatternSource(settings);
}

module.exports = {
  run,
};
