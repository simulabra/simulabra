<FindSlotImpls>
In Simulabra, it is useful to find classes that implement a given slot (e.g. `render`). To do so, first use ripgrep to find all the files containing a potential slot of that name.
<RipgrepCommand>
rg -l "name:\s*['\"]SLOTNAME['\"]" src/ demos/
</RipgrepCommand>
Then, for each file, run `bun run bin/lister.js [file]` and filter the results for only the relevant class and slot lines of the desired slot.
<FilterCommand>
awk '/^[A-Z]/{cls=$0; m=0} /#SLOTNAME($|\(| )/{if(m==0){print cls; m=1} print}'
</FilterCommand>
The full command (with error handling for lister failures):
<Command>
rg -l "name:\s*['\"]SLOTNAME['\"]" src/ demos/ 2>/dev/null | xargs -I{} sh -c 'echo "=== {} ==="; bun run bin/lister.js "{}" 2>&1 || echo "[ERROR]"' | awk '/^===/{if(p)print ""; file=$0; p=0} /^\[ERROR\]/{print file; print; p=1} /^[A-Z]/{cls=$0; m=0} /#SLOTNAME($|\(| )/{if(p==0){print file; p=1} if(m==0){print cls; m=1} print}'
</Command>
