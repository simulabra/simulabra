import base from './base.js';
import html from './html.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.class.new({
      name: 'message_log',
      slots: [
        $.component,
        $.var.new({ name: 'message_list', default: [] }),
        $.method.new({
          name: 'add',
          do(message) {
            this.message_list().push(message);
            this.element().appendChild(<div>{message}</div>);
          }
        }),
        $.method.new({
          name: 'render',
          do() {
            return this.message_list().map(m => m.render());
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
            this.element().appendChild(<div><a href="#" object={u} onclick={this.click()}>{__.deref(u).title()}</a></div>);
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
            this.element().appendChild(<div>{this.object().name()}</div>);
          }
        }),
      ]
    });

    $.class.new({
      name: 'editor',
      components: [
        $.after.new({
          name: 'init',
          do() {
            let self = this;
            this.messages($.message_log.new());
            this.browser($.object_browser.new({
              click(e) { self.messages.add(__.deref(this.properties().object).title()) }
            }));
            this.explorer($.object_explorer.new());
            Object.keys(__.tracked()).forEach(k => this.explorer().add(k));

            this.messages().add('hello there!');
          }
        }),
        $.component,
        $.var.new({ name: 'messages' }),
        $.var.new({ name: 'browser' }),
        $.var.new({ name: 'explorer' }),
        $.method.new({
          name: 'render',
          do() {
            return <div ref={this.uri()}>
                     {this.messages().render()}
                     {this.browser().render()}
                     {this.explorer().render()}
                   </div>
          }
        }),
      ]
    });
  }
}).load();
