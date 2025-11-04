import { __, base } from '../../src/base.js';
import html from '../../src/html.js';
import live from '../../src/live.js';
import service from './service.js';

export default await async function (_, $, $base, $html, $live, $service) {
  $base.Class.new({
    name: 'LiveClientDemo',
    slots: [
      $html.Component,
      $base.Signal.new({ name: 'status', default: 'ready' }),
      $base.Signal.new({ name: 'response', default: '' }),
      $base.Signal.new({ name: 'connected', default: false }),
      $base.Signal.new({ name: 'loading', default: false }),
      $base.Var.new({ name: 'client' }),
      $base.Method.new({
        name: 'connectAndCall',
        async do() {
          try {
            this.loading(true);
            this.status('connecting to server...');
            this.connected(false);
            this.response('');

            const client = $live.NodeClient.new({ uid: 'DummyClient_Web' });
            this.client(client);
            await __.sleep(100);

            await client.connect();
            this.connected(true);
            this.status('connected! calling service...');

            const dummyService = await client.serviceProxy($service.DummyService);
            const response = await dummyService.bonk();

            this.response(response);
            this.status('success');
          } catch (error) {
            this.status(`error: ${error.message}`);
            this.response('');
            console.error('Error:', error);
          } finally {
            this.loading(false);
          }
        }
      }),
      $base.Method.new({
        name: 'render',
        do() {
          return $html.HTML.t`
            <div class="windowed">
              <div class="window-bar">
                <div class="window-title">SIMULABRA LIVE CLIENT</div>
              </div>
              <div class="window-body">
                <div class="loom-col">
                  <div class="section-label">connection</div>
                  <div class="loom-row">
                    <button onclick=${() => this.connectAndCall()}>connect & call service</button>
                    <span class="spinner" hidden=${() => !this.loading()}></span>
                  </div>
                  <div class="loom-col">
                    <div>status: ${() => this.status()}</div>
                  </div>
                  <div class="section-label">response</div>
                  <div class="loom-col">
                    <div style="padding: 1em; background: var(--light-sand); min-height: 2em;">
                      ${() => this.response() || '(waiting for service call)'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }
      })
    ]
  });

  if (typeof require !== 'undefined' && require.main === module) {
    const client = $live.NodeClient.new({ uid: 'DummyClient_Bun' });
    await __.sleep(100);
    await client.connect();
    const service = await client.serviceProxy($service.DummyService);
    const response = await service.bonk();
    console.log(response);
  } else if (typeof window !== 'undefined') {
    $.LiveClientDemo.new().mount();
  }
}.module({
  name: 'dummy',
  imports: [base, html, live, service],
}).load();
