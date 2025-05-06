cp $1 ./out
bun x http-server ./out &
bun build src/base.js src/html.js demos/counter.js --outdir=out --sourcemap=linked --watch
