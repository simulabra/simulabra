rm -r ./out
mkdir -p out/swyperloom
bun build demos/*.html --outdir=out --sourcemap=linked
bun build apps/swyperloom/src/index.html --outdir=out/syperloom --sourcemap=linked
