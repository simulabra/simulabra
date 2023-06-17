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
        $.var.new({ name: 'objects' }),
        $.after.new({
          name: 'init',
          do() {
            this.linkify();
          }
        }),
        $.method.new({
          name: 'linkify',
          do() {
            this.children(this.objects().map(c => <div><a href="#" object={c} onclick={this.click()}>{__.deref(c).title()}</a></div>));
          }
        }),
      ]
    });

    // $.class.new({
    //   name: 'object_explorer',
    //   components: [
    //     $.component,
    //     $.var.new({ name: 'object' }),
    //     $.after.new({
    //       name: 'init',
    //       do() {
    //         this.children([<div>{this.object()?.name() ?? '<none>'}</div>]);
    //       }
    //     }),
    //   ]
    // });

    <$class name="object_explorer">
      <$$component />
      <$var name="object" />
      <$after name="init" do={function() { this.children([<div>{this.object()?.name() ?? '<none>'}</div>]) }}/>
    </$class>

    $.class.new({
      name: 'editor',
      components: [
        $.before.new({
          name: 'init',
          do() {
            let self = this;
            this.messages($.message_log.new());
            this.browser($.object_browser.new({
              objects: Object.keys(__.tracked()),
              click(e) {
                this.log('click');
                self.messages().add(__.deref(this.properties().object).title());

              }
            }));
            this.explorer($.object_explorer.new());

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
