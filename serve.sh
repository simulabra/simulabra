bun x http-server ./out &
bun build src/base.js src/html.js demos/counter.js demos/counter.html --outdir=out --sourcemap=linked --watch
