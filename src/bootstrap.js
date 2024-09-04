import base from './base.js';
import html from './html.js';
import llm from './llm.js';

export default await base.find('class', 'module').new({
  name: 'bootstrap',
  imports: [base, html, llm],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;
    const $el = $.html_element.proxy();

    // DEAR BOOTSTRAP WRITES THE REST OF YOUR CODE
    // chat ui
    // - input text
    // - streaming assistant response
    // - links to code locations
    $.class.new({
      name: 'chat_list',
      slots: [
        $.component,
        $.var.new({
          name: 'messages',
          default: () => [],
        }),
        $.method.new({
          name: 'stream_data',
          do: function stream_data(data) {
            if (this.messages().length > 0) {
              this.messages()[this.messages().length - 1] += data;
            }
          }
        }),
        $.method.new({
          name: 'stream_begin',
          do: function stream_begin() {
            // show loading indicator
          }
        }),
        $.method.new({
          name: 'stream_end',
          do: function stream_end() {
            // hide loading indicator
          }
        }),
    $.class.new({
      name: 'chat',
      slots: [
        $.window,
        $.var.new({
          name: 'messages',
          default: () => $.chat_list.new(),
        }),
        $.method.new({
          name: 'ask',
          doc: 'submit a use message to a conversational agent',
          do: function ask(prompt) {
            this.add_user_message(prompt)
            this.messages().stream_begin();
            const req = this.chat_request()
            req.on('data', data => this.messages().stream_data(data));
            req.on('end', () => this.messages().stream_end());
          }
        }),
        $.method.new({
          name: 'chat_request',
          do: function chat_request() {
            // send chat request
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return sjsx`
            <$messages />
            <$input />
            `;
          }
        }),
      ]
    });
    // diff view
    // - do you accept?
    // - standard format communicated via prompt
    // command syntax + examples
    // - short and memorable for icl
    // - how agent gets additional context
    // system prompt(s)
    // - thanks to prompt caching we can waste some tokens
    // - teach basics of Simulabra in 1500 tokens
    // very basic editor
    // - codemirror should suffice
    // - looming completion
    // load/save files
    // - to disk
    // - file picker

}).load();
