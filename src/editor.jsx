import base from './base.js';
import html from './html.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.class.new({
      name: 'message_log',
      components: [
        $.component,
        $.var.new({ name: 'message_list', default: [] }),
        $.method.new({
          name: 'add',
          do(message) {
            this.message_list().push(message);
            this.add_child(<div>{message}</div>);
          }
        }),
      ]
    });

    $.class.new({
      name: 'object_browser',
      components: [
        $.component,
        $.var.new({ name: 'click' }),
        $.method.new({
          name: 'add',
          do(u) {
            this.add_child(<div><a href="#" object={u} onclick={this.click()}>{__.deref(u).title()}</a></div>);
          }
        }),
      ]
    });

    $.class.new({
      name: 'object_explorer',
      components: [
        $.component,
        $.var.new({ name: 'object' }),
        $.after.new({
          name: 'init',
          do() {
            this.children([<div>{this.object()?.name() ?? '<none>'}</div>]);
          }
        }),
      ]
    });

    $.class.new({
      name: 'editor',
      components: [
        $.before.new({
          name: 'init',
          do() {
            let self = this;
            this.messages($.message_log.new());
            this.browser($.object_browser.new({
              click(e) { self.messages.add(__.deref(this.properties().object).title()) }
            }));
            this.explorer($.object_explorer.new());
            Object.keys(__.tracked()).forEach(k => this.browser().add(k));

            this.messages().add('hello there!');
            this.messages().render();
            this.browser().render();
            this.explorer().render();
          }
        }),
        $.component,
        $.var.new({ name: 'messages' }),
        $.var.new({ name: 'browser' }),
        $.var.new({ name: 'explorer' }),
        $.method.new({
          name: 'render',
          override: true,
          do() {
            this.inner(...<>
              <div class="col">
                {this.browser()}
              </div>
              <div class="col">
                <div className="code_editor">Code here</div>
              </div>
              <div class="col">
                {this.explorer()}
                {this.messages()}
              </div>
            </>);
          }
        }),
      ]
    });
  }
}).load();
