rm -r ./out
mkdir out
bun x http-server ./out &
bun build demos/*.html --outdir=out --sourcemap=linked --watch
