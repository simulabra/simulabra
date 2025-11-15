import { __, base } from '../../src/base.js';
import html from '../../src/html.js';
import live from '../../src/live.js';
import service from './service.js';

export default await async function (_, $, $base, $html, $live, $service) {
  $base.Class.new({
    name: 'DummyClient',
    slots: [
      $html.Component,
      $base.Signal.new({ name: 'response', default: '' }),
      $base.Signal.new({ name: 'connected', default: false }),
      $base.Signal.new({ name: 'loading', default: false }),
      $base.Var.new({ name: 'domain' }),
      $base.Var.new({ name: 'service' }),
      $base.Var.new({ name: 'client' }),
      $base.Method.new({
        name: 'connect',
        async do() {
          this._client = $live.NodeClient.new({ uid: `DummyClient_${this._domain}` });
          await __.sleep(100);

          await this._client.connect();
          this._service = await this._client.serviceProxy($service.DummyService);
          this._connected = true;
        }
      }),
      $base.Method.new({
        name: 'bonk',
        async do() {
          this._response = await this._service.bonk();
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
                  <div class="loom-row">
                    <button onclick=${() => this.bonk()}>bonk</button>
                    <span class="spinner" hidden=${() => this.connected()}></span>
                  </div>
                  <div class="loom-col">
                    <div style="padding: 1em; background: var(--light-sand); min-height: 2em;">
                      ${() => this.response() || '(remaining unbonked)'}
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
    const client = $.DummyClient.new({ domain: 'Bun' });
    await client.connect();
    const response = await client._service.bonk();
    console.log(response);
  } else if (typeof window !== 'undefined') {
    const client = $.DummyClient.new({ domain: 'Web' });
    await client.connect();
    client.mount();
  }
}.module({
  name: 'dummy',
  imports: [base, html, live, service],
}).load();
