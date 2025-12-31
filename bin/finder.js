import { $ } from "bun";

const slotName = process.argv[2];
if (!slotName) {
  console.error("Usage: bun run bin/finder.js <slot-name>");
  process.exit(1);
}

const files = await $`rg -l "name:\\s*['\"]${slotName}['\"]" src/ demos/ tests/ bin/`.nothrow().text();

if (!files.trim()) {
  console.log(`No implementations of '${slotName}' found`);
  process.exit(0);
}

const slotPattern = new RegExp(`#${slotName}($|\\(| )`);

for (const file of files.trim().split("\n")) {
  const result = await $`bun run bin/lister.js ${file}`.nothrow().quiet();
  if (result.exitCode !== 0) {
    console.log(`=== ${file} ===`);
    console.log("[ERROR] lister failed");
    continue;
  }
  const lines = result.stdout.toString().split("\n");
  let currentClass = "";
  let printedClass = false;
  let output = [];
  for (const line of lines) {
    if (/^[A-Z]/.test(line)) {
      currentClass = line;
      printedClass = false;
    } else if (slotPattern.test(line)) {
      if (!printedClass) {
        output.push(currentClass);
        printedClass = true;
      }
      output.push(line);
    }
  }
  if (output.length > 0) {
    console.log(`=== ${file} ===`);
    console.log(output.join("\n"));
  }
}
