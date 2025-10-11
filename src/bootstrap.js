import { __, base } from './base.js';
import html from './html.js';
import llm from './llm.js';

const __ = globalThis.SIMULABRA;

export default await function(_, $, $base, $html, $llm) {
  const $el = $html.HTMLElement.proxy();

  // DEAR BOOTSTRAP WRITES THE REST OF YOUR CODE
  // chat ui
  // - input text
  // - streaming assistant response
  // - links to code locations
  $base.Class.new({
    name: 'ChatMessage',
    doc: 'a turn in a conversation between a user and an assistant',
    slots: [
      $html.Component,
      $base.EnumVar.new({
        name: 'role',
        doc: 'who is talking',
        choices: ['user', 'assistant'],
        default: 'user',
      }),
      $base.Var.new({
        name: 'content',
        doc: 'what is being said',
        type: 'string',
      }),
      $base.Var.new({
        name: 'streaming',
        doc: 'more to come',
        default: false,
      }),
      $base.Command.new({
        name: 'streamData',
        doc: 'add new tokens from the response',
        run(data) {
          this.content(this.content() + data);
          this.streaming(true);
        },
      }),
      $base.Command.new({
        name: 'streamEnd',
        run() {
          this.streaming(false);
        },
      }),
      $base.Method.new({
        name: 'render',
        do: function render() {
          return `${this.role}: ${this.content}${this.streaming() ? '^' : ''}`;
        },
      }),
    ],
  });

  $base.Class.new({
    name: 'ChatList',
    doc: 'the back and forth conversation between a user and an llm assistant',
    slots: [
      $html.Component,
      $html.ListElement.new({
        name: 'messages',
      }),
      $base.Command.new({
        name: 'streamBegin',
        doc: 'show loading indicator',
        run() {
          const streamingMessage = $.ChatMessage.new({ name: 'streamingMessage', role: 'assistant', content: '', streaming: true });
          this.messages().push(streamingMessage);
          return streamingMessage;
        },
      }),
      $base.Method.new({
        name: 'conversation',
        doc: 'get the API-formatted conversation of a chat in a pojso',
        do: function conversation() {
          return this.messages().map(m => ({ role: m.role(), content: m.content() }));
        },
      }),
      $base.Method.new({
        name: 'render',
        do: function render() {
          return this.messages().join('\n');
        },
      }),
    ],
  });

  $base.Class.new({
    name: 'Chat',
    slots: [
      $html.Component,
      $html.Window,
      $.ChatList.new({
        name: 'messages',
      }),
      $html.Input.new({
        name: 'chatInput',
        placeholder: 'Message bootstrap...',
      }),
      $base.Command.new({
        name: 'ask',
        doc: 'submit a user message to a conversational agent',
        run(prompt) {
          return new Promise((resolve, reject) => {
            this.addUserMessage(prompt);
            const conversation = this.messages().conversation();
            const message = this.messages().streamBegin();
            const req = await this.chatRequest(conversation);
            req.on('data', data => message.streamData(data));
            req.on('error', err => reject(err));
            req.on('end', () => {
              message.streamEnd();
              resolve(message);
            });
          });
        },
      }),
      $base.Method.new({
        name: 'chatRequest',
        do: async function chatRequest(conversation) {
          // send chat request
          // TODO: make API
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
      $base.Method.new({
        name: 'render',
        do: function render() {
          return this.messages().render() + '\n\n' + this.chatInput().render();
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
}.module({
  name: 'Bootstrap',
  imports: [base, html, llm],
}).load();
