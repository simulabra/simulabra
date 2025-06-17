rm -r ./out
mkdir out
bun build demos/*.html --outdir=out --sourcemap=linked
