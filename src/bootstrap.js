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
      name: 'chat_message',
      doc: 'a turn in a conversation between a user and an llm assistant',
      slots: [
        $.component,
        $.var.new({
          name: 'role',
          doc: 'who is talking',
          choices: ['user', 'assistant'],
          default: 'user',
        }),
        $.var.new({
          name: 'content',
          type: 'string',
        }),
        $.var.new({
          name: 'streaming',
          doc: 'loading indicator',
          default: false,
        }),
        $.method.new({
          name: 'stream_data',
          doc: 'add new tokens from the response',
          do: function stream_data(data) {
            this.content(this.content() + data);
          }
        }),
        $.method.new({
          name: 'stream_end',
          do: function stream_end() {
            this.streaming(false);
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return sjsx`
            `;
          }
        }),
      ]
    });
    $.class.new({
      name: 'chat_list',
      doc: 'the back and forth conversation between a user and an llm assistant',
      slots: [
        $.component,
        $.var.new({
          name: 'messages',
          default: () => [],
        }),
        $.method.new({
          name: 'stream_begin',
          doc: 'show loading indicator',
          do: function stream_begin() {
            const streaming_message = $.chat_message.new({ role: 'assistant', content: '', streaming: true });
            this.messages(...this.messages(), streaming_message );
            return streaming_message;
          }
        }),
        $.method.new({
          name: 'conversation',
          do: function conversation() {
            return this.messages().map(m => { role: m.role(), content: m.content() });
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return sjsx`
            <div>
            ${this.messages().slice(-1)}
            </div>
            `;
          }
        }),
    });

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
            const conversation = this.messages().conversation();
            const message = this.messages().stream_begin();
            const req = this.chat_request(conversation)
            return new Promise((resolve, reject) => {
              req.on('data', data => message.stream_data(data));
              req.on('error', err => reject(err));
              req.on('end', () => {
                message.stream_end();
                resolve(message);
              });
            });
          }
        }),
        $.method.new({
          name: 'chat_request',
          do: function chat_request(conversation) {
            // send chat request
            const res = await fetch(`${this.api_url()}/v1/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet',
                messages: conversation,
              }),
            });
            const json = await res.json();
            return $.pyserver_completion_results.new(json);
          }
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
