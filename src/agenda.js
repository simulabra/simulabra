import base from './base.js';
import html from './html.js';
import llm from './llm.js';

export default await base.find('class', 'module').new({
  name: 'agenda',
  imports: [base, html, llm],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;
    const $el = $.html_element.proxy();

    $.class.new({
      name: 'item',
      doc: 'a generic item in the agenda',
      slots: [
        $.component,
        $.Var.new({
          name: 'title',
          type: 'string',
        }),
        $.Var.new({
          name: 'created',
          type: 'date',
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div({}, `[${this.created().toISOString()}] ${this.title()}`);
          }
        }),
      ]
    });

    $.class.new({
      name: 'new_item',
      doc: 'a field to enter items into the agenda',
      slots: [
        $.component,
        $.Var.new({
          name: 'item_input',
        }),
        $.Var.new({
          name: 'submit_button',
          default() {
            return $.button.new({
              parent: this,
              slots: [
                'add to agenda'
              ]
            });
          }
        }),
        $.after.new({
          name: 'init',
          do: function init__after() {
            this.item_input($.input.new({
              name: `todo?`,
              parent: this
            }));
          },
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div({}, this.item_input(), this.submit_button());
          }
        }),
      ]
    });

    $.class.new({
      name: 'agenda',
      slots: [
        $.window,
        $.application,
        $.Var.new({
          name: 'items',
          default: [],
        }),
        $.Var.new({
          name: 'new_item',
          default() {
            return $.new_item.new({
              parent: this
            });
          }
        }),
        $.Method.new({
          name: 'add_item',
          do: function add_item(item) {
            this.items([...this.items(), item]);
          },
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div(
              {},
              'agenda',
              ...this.items(),
              this.new_item(),
            );
          }
        }),
      ],
    });

    let agenda = $.agenda.new();
    agenda.add_item($.item.new({
      title: 'Make todo list app',
      created: new Date(),
    }));
    document.body.appendChild(agenda.to_dom());
  },
}).load();
