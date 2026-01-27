import { __, base } from './base.js';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// Helper functions (defined outside module scope so methods can capture them)
const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
};

const staticFileResponse = async (filePath, contentType) => {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file, {
      headers: { 'Content-Type': contentType }
    });
  }
  return null;
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const mimeType = (path) => {
  const ext = path.slice(path.lastIndexOf('.'));
  return MIME_TYPES[ext] || 'application/octet-stream';
};

export default await async function (_, $) {
  // ═══════════════════════════════════════════════════════════════════════════
  // Bun.serve HTTP Layer (Phase 1)
  // ═══════════════════════════════════════════════════════════════════════════

  // Export helpers for external use
  _.jsonResponse = jsonResponse;
  _.staticFileResponse = staticFileResponse;
  _.mimeType = mimeType;

  $.Class.new({
    name: 'HttpError',
    doc: 'Structured HTTP error with status code and optional error code',
    slots: [
      $.Var.new({ name: 'status', default: 500 }),
      $.Var.new({ name: 'message', default: 'Internal Server Error' }),
      $.Var.new({ name: 'code' }),
      $.Var.new({ name: 'data' }),
      $.Method.new({
        name: 'toResponse',
        do() {
          return {
            ok: false,
            error: this.message(),
            code: this.code(),
            data: this.data()
          };
        }
      })
    ]
  });

  $.Class.new({
    name: 'HttpContext',
    doc: 'Request context carrying parsed request data through handler chain',
    slots: [
      $.Var.new({ name: 'request' }),
      $.Var.new({ name: 'url' }),
      $.Var.new({ name: 'method' }),
      $.Var.new({ name: 'pathname' }),
      $.Var.new({ name: 'params', default: () => ({}) }),
      $.Var.new({ name: 'body' }),
      $.Var.new({ name: 'startedAt' }),
      $.Var.new({ name: 'requestId' }),
      $.After.new({
        name: 'init',
        do() {
          const req = this.request();
          if (req && !this.url()) {
            const url = new URL(req.url);
            this.url(url);
            this.method(req.method);
            this.pathname(url.pathname);
          }
          if (!this.startedAt()) {
            this.startedAt(Date.now());
          }
          if (!this.requestId()) {
            this.requestId(randomUUID().slice(0, 8));
          }
        }
      }),
      $.Method.new({
        name: 'elapsed',
        do() {
          return Date.now() - this.startedAt();
        }
      })
    ]
  });

  $.Class.new({
    name: 'HttpHandler',
    doc: 'Interface for HTTP request handlers',
    slots: [
      $.Virtual.new({ name: 'match' }),
      $.Virtual.new({ name: 'handle' })
    ]
  });

  $.Class.new({
    name: 'HttpRouter',
    doc: 'Routes requests to first matching handler',
    slots: [
      $.Var.new({ name: 'handlers', default: () => [] }),
      $.Method.new({
        name: 'addHandler',
        do(handler) {
          this.handlers().push(handler);
          return this;
        }
      }),
      $.Method.new({
        name: 'route',
        async do(ctx) {
          for (const handler of this.handlers()) {
            if (handler.match(ctx)) {
              return await handler.handle(ctx);
            }
          }
          return null;
        }
      }),
      $.Method.new({
        name: 'handle',
        async do(request) {
          const ctx = _.HttpContext.new({ request });
          const result = await this.route(ctx);
          if (result instanceof Response) {
            return result;
          }
          if (result === null) {
            return jsonResponse({ ok: false, error: 'Not Found' }, 404);
          }
          return jsonResponse({ ok: true, value: result });
        }
      })
    ]
  });

  $.Class.new({
    name: 'MethodPathHandler',
    doc: 'Handler matching HTTP method and path pattern',
    slots: [
      _.HttpHandler,
      $.Var.new({ name: 'httpMethod', default: 'GET' }),
      $.Var.new({ name: 'path' }),
      $.Var.new({ name: 'pathPattern' }),
      $.Var.new({ name: 'handlerFn' }),
      $.After.new({
        name: 'init',
        do() {
          const path = this.path();
          if (path && path.includes(':')) {
            const pattern = path.replace(/:(\w+)/g, '(?<$1>[^/]+)');
            this.pathPattern(new RegExp(`^${pattern}$`));
          }
        }
      }),
      $.Method.new({
        name: 'match',
        do(ctx) {
          if (ctx.method() !== this.httpMethod()) {
            return false;
          }
          const pattern = this.pathPattern();
          if (pattern) {
            const match = pattern.exec(ctx.pathname());
            if (match) {
              ctx.params(match.groups || {});
              return true;
            }
            return false;
          }
          return ctx.pathname() === this.path();
        }
      }),
      $.Method.new({
        name: 'handle',
        async do(ctx) {
          return await this.handlerFn()(ctx);
        }
      })
    ]
  });

  $.Class.new({
    name: 'JsonBody',
    doc: 'Mixin that parses JSON request body into ctx.body',
    slots: [
      $.AsyncBefore.new({
        name: 'handle',
        async do(ctx) {
          const req = ctx.request();
          const contentType = req.headers.get('content-type') || '';
          if (contentType.includes('application/json') && req.body) {
            try {
              const text = await req.text();
              if (text) {
                ctx.body(JSON.parse(text));
              }
            } catch (e) {
              throw _.HttpError.new({
                status: 400,
                message: 'Invalid JSON body',
                code: 'INVALID_JSON'
              });
            }
          }
        }
      })
    ]
  });

  $.Class.new({
    name: 'ApiRouter',
    doc: 'Full-featured router with JSON parsing, error handling, and logging',
    slots: [
      _.HttpRouter,
      $.Method.new({
        name: 'parseJsonBody',
        async do(ctx) {
          const req = ctx.request();
          const contentType = req.headers.get('content-type') || '';
          if (contentType.includes('application/json') && req.body) {
            try {
              const text = await req.text();
              if (text) {
                ctx.body(JSON.parse(text));
              }
            } catch (e) {
              throw _.HttpError.new({
                status: 400,
                message: 'Invalid JSON body',
                code: 'INVALID_JSON'
              });
            }
          }
        }
      }),
      $.Method.new({
        name: 'handle',
        override: true,
        async do(request) {
          const ctx = _.HttpContext.new({ request });
          let result;
          let status = 200;
          try {
            await this.parseJsonBody(ctx);
            result = await this.route(ctx);
            if (result instanceof Response) {
              status = result.status;
              this.tlog?.(`[${ctx.requestId()}] ${ctx.method()} ${ctx.pathname()} ${status} ${ctx.elapsed()}ms`);
              return result;
            }
            if (result === null) {
              status = 404;
              result = jsonResponse({ ok: false, error: 'Not Found' }, 404);
            } else {
              result = jsonResponse({ ok: true, value: result });
            }
          } catch (e) {
            if (e.class?.() === _.HttpError) {
              status = e.status();
              result = jsonResponse(e.toResponse(), status);
            } else {
              status = 500;
              this.tlog?.(`request error [${ctx.requestId()}]:`, e.message);
              result = jsonResponse({
                ok: false,
                error: 'Internal Server Error',
                code: 'INTERNAL_ERROR'
              }, 500);
            }
          }
          this.tlog?.(`[${ctx.requestId()}] ${ctx.method()} ${ctx.pathname()} ${status} ${ctx.elapsed()}ms`);
          return result;
        }
      })
    ]
  });

  $.Class.new({
    name: 'StaticFileHandler',
    doc: 'Serves static files from a directory',
    slots: [
      _.HttpHandler,
      $.Var.new({ name: 'urlPrefix', default: '/' }),
      $.Var.new({ name: 'rootDir' }),
      $.Var.new({ name: 'indexFile', default: 'index.html' }),
      $.Method.new({
        name: 'match',
        do(ctx) {
          return ctx.method() === 'GET' && ctx.pathname().startsWith(this.urlPrefix());
        }
      }),
      $.Method.new({
        name: 'handle',
        async do(ctx) {
          let path = ctx.pathname().slice(this.urlPrefix().length) || '/';
          if (path.endsWith('/')) {
            path += this.indexFile();
          }
          const filePath = `${this.rootDir()}/${path}`;
          const file = Bun.file(filePath);
          if (await file.exists()) {
            return new Response(file, {
              headers: { 'Content-Type': mimeType(filePath) }
            });
          }
          return null;
        }
      })
    ]
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Legacy Node.js HTTP Layer (existing code)
  // ═══════════════════════════════════════════════════════════════════════════

  $.Class.new({
    name: 'HTTPRequest',
    slots: [
      $.Var.new({
        name: 'inner'
      }),
      $.Var.new({
        name: 'start'
      }),
      $.Method.new({
        name: 'elapsed',
        do() {
          return +new Date() - +this.start();
        }
      }),
      $.Method.new({
        name: 'drain',
        do: function drain() {
          const req = this.inner();
          return new Promise((resolve, reject) => {
            if (req.Method !== 'POST' || req.headers['content-type'] !== 'application/json') {
              return reject('malformed request');
            }
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                return resolve(parsed);
              } catch (e) {
                return reject(e);
              }
            });
          });
        },
      }),
    ]
  });
  $.Class.new({
    name: 'HTTPResponse',
    slots: [
      $.Var.new({
        name: 'inner'
      }),
      $.Method.new({
        name: 'ok',
        do(message, ct = 'text/html') {
          this.inner().writeHead(200, { 'Content-type': ct });
          this.inner().end(message);
        }
      }),
    ]
  });
  $.Class.new({
    name: 'HTTPServer',
    slots: [
      $.Var.new({ name: 'nodeServer' }),
      $.Var.new({
        name: 'port',
        default: '3034',
      }),
      $.Var.new({
        name: 'slots',
        default: [],
      }),
      $.After.new({
        name: 'init',
        do() {
          this.nodeServer(createServer((req, res) => {
            for (const handler of this.slots()) {
              if (handler.match(req.url)) {
                return handler.handle(this, _.HTTPRequest.new({ inner: req, start: new Date() }), _.HTTPResponse.new({ inner: res }));
              }
            }
            res.writeHead(404);
            res.end();
          }));
          this.nodeServer().listen(this.port());
        }
      }),
    ]
  });
  $.Class.new({
    name: 'RequestHandler',
    slots: [
      $.Virtual.new({
        name: 'match'
      }),
      $.Virtual.new({
        name: 'handle',
      }),
    ]
  });

  $.Class.new({
    name: 'HandlerLogger',
    slots: [
      $.After.new({
        name: 'handle',
        do(app, req, res) {
          this.log(`handle ${req.inner().url} in ${req.elapsed()} ms`);
        }
      })
    ]
  });
  $.Class.new({
    name: 'VarHandler',
    slots: [
      $.Var.new({
        name: 'handler',
      }),
      $.Method.new({
        name: 'handle',
        do(...args) {
          this.handler().apply(this, args)
        }
      }),
    ]
  });
  $.Class.new({
    name: 'PathRequestHandler',
    slots: [
      _.RequestHandler,
      _.VarHandler,
      _.HandlerLogger,
      $.Var.new({
        name: 'path',
      }),
      $.Method.new({
        name: 'match',
        do(url) {
          return this.path() === url;
        }
      }),
    ]
  });
  $.Class.new({
    name: 'FiletypeRequestHandler',
    slots: [
      _.RequestHandler,
      _.HandlerLogger,
      $.Var.new({ name: 'filetypes' }),
      $.Var.new({ name: 'mimeType' }),
      $.Method.new({
        name: 'match',
        do(url) {
          const filetype = /\.([^\.]+)$/.exec(url)[1];
          this.log(filetype, this.filetypes());
          return this.filetypes().includes(filetype);
        }
      }),
      $.Method.new({
        name: 'handle',
        do: function handle(app, req, res) {
          const path = req.inner().url;
          let fileName = '.' + path;
          res.ok(readFileSync(fileName).toString(), this.mimeType());
        }
      }),
    ]
  });

  $.Class.new({
    name: 'HTTPRequestCommand',
    slots: [
      $.Command,
      $.Var.new({ name: 'url' }),
      $.Var.new({ name: 'Method' }),
      $.Var.new({ name: 'responseType' }),
      $.Var.new({ name: 'data' }),
      $.Method.new({
        name: 'run',
        async: true,
        do: async function run() {
          const options = {
            method: this.Method(),
            headers: {
              'Content-Type': 'application/json'
            }
          };

          if (this.data()) {
            options.body = JSON.stringify(this.data());
          }

          const response = await fetch(this.url(), options);

          if (this.responseType() === 'json') {
            return response.json();
          } else if (this.responseType() === 'text') {
            return response.text();
          } else if (this.responseType() === 'arrayBuffer') {
            return response.arrayBuffer();
          } else if (this.responseType() === 'blob') {
            return response.blob();
          } else {
            return response;
          }
        }
      }),
    ]
  });
}.module({
 name: 'http',
 imports: [base],
}).load();
