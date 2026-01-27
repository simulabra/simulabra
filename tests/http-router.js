import { __, base } from '../src/base.js';
import test from '../src/test.js';
import http from '../src/http.js';

// Access raw namespace for helper functions
const httpHelpers = await http;

export default await async function (_, $, $test, _http) {

  $test.Case.new({
    name: 'HttpContextInit',
    doc: 'HttpContext should parse request URL and set defaults',
    do() {
      const req = new Request('http://localhost:3030/api/v1/tasks?filter=active');
      const ctx = _http.HttpContext.new({ request: req });

      this.assertEq(ctx.method(), 'GET');
      this.assertEq(ctx.pathname(), '/api/v1/tasks');
      this.assert(ctx.url().searchParams.get('filter') === 'active', 'should have query param');
      this.assert(ctx.requestId(), 'should have requestId');
      this.assert(ctx.startedAt() > 0, 'should have startedAt');
    }
  });

  $test.Case.new({
    name: 'HttpContextElapsed',
    doc: 'HttpContext should track elapsed time',
    do() {
      const req = new Request('http://localhost:3030/test');
      const ctx = _http.HttpContext.new({ request: req, startedAt: Date.now() - 100 });

      this.assert(ctx.elapsed() >= 100, 'elapsed should be at least 100ms');
    }
  });

  $test.Case.new({
    name: 'HttpErrorToResponse',
    doc: 'HttpError should serialize to response format',
    do() {
      const err = _http.HttpError.new({
        status: 400,
        message: 'Bad Request',
        code: 'INVALID_INPUT',
        data: { field: 'name' }
      });

      const response = err.toResponse();
      this.assertEq(response.ok, false);
      this.assertEq(response.error, 'Bad Request');
      this.assertEq(response.code, 'INVALID_INPUT');
      this.assertEq(response.data.field, 'name');
    }
  });

  $test.Case.new({
    name: 'MethodPathHandlerExactMatch',
    doc: 'MethodPathHandler should match exact paths',
    do() {
      const handler = _http.MethodPathHandler.new({
        httpMethod: 'POST',
        path: '/api/v1/tasks/list',
        handlerFn: () => 'matched'
      });

      const ctx1 = _http.HttpContext.new({
        request: new Request('http://localhost:3030/api/v1/tasks/list', { method: 'POST' })
      });
      const ctx2 = _http.HttpContext.new({
        request: new Request('http://localhost:3030/api/v1/tasks/other', { method: 'POST' })
      });
      const ctx3 = _http.HttpContext.new({
        request: new Request('http://localhost:3030/api/v1/tasks/list', { method: 'GET' })
      });

      this.assert(handler.match(ctx1), 'should match exact path + method');
      this.assert(!handler.match(ctx2), 'should not match different path');
      this.assert(!handler.match(ctx3), 'should not match different method');
    }
  });

  $test.Case.new({
    name: 'MethodPathHandlerParamMatch',
    doc: 'MethodPathHandler should match paths with parameters',
    do() {
      const handler = _http.MethodPathHandler.new({
        httpMethod: 'GET',
        path: '/api/v1/tasks/:id',
        handlerFn: (ctx) => ctx.params()
      });

      const ctx = _http.HttpContext.new({
        request: new Request('http://localhost:3030/api/v1/tasks/123')
      });

      this.assert(handler.match(ctx), 'should match with param');
      this.assertEq(ctx.params().id, '123', 'should extract param');
    }
  });

  $test.AsyncCase.new({
    name: 'HttpRouterRouting',
    doc: 'HttpRouter should route to first matching handler',
    async do() {
      const router = _http.HttpRouter.new();

      router.addHandler(_http.MethodPathHandler.new({
        httpMethod: 'GET',
        path: '/first',
        handlerFn: () => 'first'
      }));
      router.addHandler(_http.MethodPathHandler.new({
        httpMethod: 'GET',
        path: '/second',
        handlerFn: () => 'second'
      }));

      const res1 = await router.handle(new Request('http://localhost:3030/first'));
      const res2 = await router.handle(new Request('http://localhost:3030/second'));
      const res3 = await router.handle(new Request('http://localhost:3030/unknown'));

      const data1 = await res1.json();
      const data2 = await res2.json();
      const data3 = await res3.json();

      this.assertEq(data1.ok, true);
      this.assertEq(data1.value, 'first');
      this.assertEq(data2.value, 'second');
      this.assertEq(data3.ok, false);
      this.assertEq(res3.status, 404);
    }
  });

  $test.AsyncCase.new({
    name: 'ApiRouterJsonParsing',
    doc: 'ApiRouter should parse JSON body',
    async do() {
      const router = _http.ApiRouter.new();

      router.addHandler(_http.MethodPathHandler.new({
        httpMethod: 'POST',
        path: '/echo',
        handlerFn: (ctx) => ctx.body()
      }));

      const req = new Request('http://localhost:3030/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello' })
      });

      const res = await router.handle(req);
      const data = await res.json();

      this.assertEq(data.ok, true);
      this.assertEq(data.value.message, 'hello');
    }
  });

  $test.AsyncCase.new({
    name: 'ApiRouterErrorHandling',
    doc: 'ApiRouter should catch errors and return JSON error responses',
    async do() {
      const router = _http.ApiRouter.new();

      router.addHandler(_http.MethodPathHandler.new({
        httpMethod: 'GET',
        path: '/error',
        handlerFn: () => {
          throw _http.HttpError.new({ status: 400, message: 'Test error', code: 'TEST_ERR' });
        }
      }));

      router.addHandler(_http.MethodPathHandler.new({
        httpMethod: 'GET',
        path: '/internal',
        handlerFn: () => {
          throw new Error('Unexpected failure');
        }
      }));

      const res1 = await router.handle(new Request('http://localhost:3030/error'));
      const res2 = await router.handle(new Request('http://localhost:3030/internal'));

      const data1 = await res1.json();
      const data2 = await res2.json();

      this.assertEq(res1.status, 400);
      this.assertEq(data1.ok, false);
      this.assertEq(data1.error, 'Test error');
      this.assertEq(data1.code, 'TEST_ERR');

      this.assertEq(res2.status, 500);
      this.assertEq(data2.ok, false);
      this.assertEq(data2.code, 'INTERNAL_ERROR');
    }
  });

  $test.AsyncCase.new({
    name: 'StaticFileHandlerMatch',
    doc: 'StaticFileHandler should match paths with prefix',
    async do() {
      const handler = _http.StaticFileHandler.new({
        urlPrefix: '/static/',
        rootDir: '/tmp/nonexistent'
      });

      const ctx1 = _http.HttpContext.new({
        request: new Request('http://localhost:3030/static/file.js')
      });
      const ctx2 = _http.HttpContext.new({
        request: new Request('http://localhost:3030/other/file.js')
      });
      const ctx3 = _http.HttpContext.new({
        request: new Request('http://localhost:3030/static/file.js', { method: 'POST' })
      });

      this.assert(handler.match(ctx1), 'should match GET with prefix');
      this.assert(!handler.match(ctx2), 'should not match different prefix');
      this.assert(!handler.match(ctx3), 'should not match non-GET');
    }
  });

  $test.Case.new({
    name: 'MimeTypeDetection',
    doc: 'mimeType helper should detect common file types',
    do() {
      this.assertEq(httpHelpers.mimeType('file.html'), 'text/html');
      this.assertEq(httpHelpers.mimeType('app.js'), 'application/javascript');
      this.assertEq(httpHelpers.mimeType('style.css'), 'text/css');
      this.assertEq(httpHelpers.mimeType('data.json'), 'application/json');
      this.assertEq(httpHelpers.mimeType('image.png'), 'image/png');
      this.assertEq(httpHelpers.mimeType('unknown.xyz'), 'application/octet-stream');
    }
  });

  $test.Case.new({
    name: 'JsonResponseHelper',
    do() {
      const response = httpHelpers.jsonResponse({ test: 'data' }, 201);
      this.assertEq(response.status, 201);
      this.assertEq(response.headers.get('Content-Type'), 'application/json');
    }
  });

}.module({
  name: 'test.http.router',
  imports: [base, test, http],
}).load();
