rm -r ./out
mkdir -p out/swyperloom
bun build demos/*.html --outdir=out --sourcemap=linked
bun build apps/swyperloom/index.html --outdir=out/swyperloom --public-path=swyperloom/ --sourcemap=linked
