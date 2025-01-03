import base from './base.js';
import html from './html.js';
import llm from './llm.js';

export default await __.$().Module.new({
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
      doc: 'a turn in a conversation between a user and an assistant',
      slots: [
        $.Component,
        $.EnumVar.new({
          name: 'role',
          doc: 'who is talking',
          choices: ['user', 'assistant'],
          default: 'user',
        }),
        $.Var.new({
          name: 'content',
          doc: 'what is being said',
          type: 'string',
        }),
        $.Var.new({
          name: 'streaming',
          doc: 'more to come',
          default: false,
        }),
        $.Method.new({
          name: 'streamData',
          doc: 'add new tokens from the response',
          do: function streamData(data) {
            this.content(this.content() + data);
            this.streaming(true);
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
            return $.sjsx`${this.role}: ${this.content}${this.streaming() ? '^' : ''}`;
          },
        }),
      ],
    });

    $.Class.new({
      name: 'ChatList',
      doc: 'the back and forth conversation between a user and an llm assistant',
      slots: [
        $.Component,
        $.ListElement.new({
          name: 'messages',
        }),
        $.Method.new({
          name: 'streamBegin',
          doc: 'show loading indicator',
          do: function streamBegin() {
            const streamingMessage = $.ChatMessage.new({ name: 'streamingMessage', role: 'assistant', content: '', streaming: true });
            this.messages().push(streamingMessage);
            return streamingMessage;
          },
        }),
        $.Method.new({
          name: 'conversation',
          doc: 'get the API-formatted conversation of a chat in a pojso',
          do: function conversation() {
            return this.messages().map(m => ({ role: m.role(), content: m.content() }));
          },
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $.sjsx`
            <div>
              ${this.messages()}
            </div>
            `;
          },
        }),
      ],
    });

    $.Class.new({
      name: 'Chat',
      slots: [
        $.Component,
        $.Window,
        $.ChatList.new({
          name: 'messages',
        }),
        $.Input.new({
          name: 'chatInput',
          placeholder: 'Message bootstrap...',
        }),
        $.Method.new({
          name: 'ask',
          doc: 'submit a user message to a conversational agent',
          do: function ask(prompt) {
            return new Promise((resolve, reject) => {
              this.addUserMessage(prompt);
              const conversation = this.messages().conversation();
              const message = this.messages().streamBegin();
              const req = this.chatRequest(conversation);
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
        $.Method.new({
          name: 'render',
          do: function render() {
            return $.sjsx`
            ${this.messages()}
            ${this.chatInput()}
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
