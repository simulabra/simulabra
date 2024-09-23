import base from './base.js';
import html from './html.js';
import llm from './llm.js';

export default await base.find('Class', 'Module').new({
  name: 'Bootstrap',
  imports: [base, html, llm],
  async onLoad(_, $) {
    const __ = globalThis.SIMULABRA;
    const $el = $.HTMLElement.proxy();

    // DEAR BOOTSTRAP WRITES THE REST OF YOUR CODE
    // chat ui
    // - input text
    // - streaming assistant response
    // - links to code locations
    $.Class.new({
      name: 'ChatMessage',
      doc: 'a turn in a conversation between a user and an llm assistant',
      slots: [
        $.component,
        $.Var.new({
          name: 'role',
          doc: 'who is talking',
          choices: ['user', 'assistant'],
          default: 'user',
        }),
        $.Var.new({
          name: 'content',
          type: 'string',
        }),
        $.Var.new({
          name: 'streaming',
          doc: 'loading indicator',
          default: false,
        }),
        $.Method.new({
          name: 'streamData',
          doc: 'add new tokens from the response',
          do: function streamData(data) {
            this.content(this.content() + data);
          },
        }),
        $.Method.new({
          name: 'streamEnd',
          do: function streamEnd() {
            this.streaming(false);
          },
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return sjsx`
            `;
          },
        }),
      ],
    });

    $.Class.new({
      name: 'ChatList',
      doc: 'the back and forth conversation between a user and an llm assistant',
      slots: [
        $.component,
        $.Var.new({
          name: 'messages',
          default: () => [],
        }),
        $.Method.new({
          name: 'streamBegin',
          doc: 'show loading indicator',
          do: function streamBegin() {
            const streamingMessage = $.ChatMessage.new({ role: 'assistant', content: '', streaming: true });
            this.messages(...this.messages(), streamingMessage);
            return streamingMessage;
          },
        }),
        $.Method.new({
          name: 'conversation',
          do: function conversation() {
            return this.messages().map(m => ({ role: m.role(), content: m.content() }));
          },
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return sjsx`
            <div>
              ${this.messages().slice(-1)}
            </div>
            `;
          },
        }),
      ],
    });

    $.Class.new({
      name: 'Chat',
      slots: [
        $.window,
        $.Var.new({
          name: 'messages',
          default: () => $.ChatList.new(),
        }),
        $.Method.new({
          name: 'ask',
          doc: 'submit a user message to a conversational agent',
          do: function ask(prompt) {
            this.addUserMessage(prompt);
            const conversation = this.messages().conversation();
            const message = this.messages().streamBegin();
            const req = this.chatRequest(conversation);
            return new Promise((resolve, reject) => {
              req.on('data', data => message.streamData(data));
              req.on('error', err => reject(err));
              req.on('end', () => {
                message.streamEnd();
                resolve(message);
              });
            });
          },
        }),
        $.Method.new({
          name: 'chatRequest',
          do: async function chatRequest(conversation) {
            // send chat request
            const res = await fetch(`${this.apiUrl()}/v1/chat/completions`, {
              Method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet',
                messages: conversation,
              }),
            });
            const json = await res.json();
            return $.PyserverCompletionResults.new(json);
          },
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return sjsx`
            <$messages />
            <$input />
            `;
          },
        }),
      ],
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

  },
}).load();
