import base from './base.js';
import http from './http.js';
import chatConfig from '../.chatconfig.json';
import { readFileSync } from 'fs';

export default await __.$().Module.new({
  name: 'agent',
  imports: [base, http],
  async mod(_, $) {
    $.Class.new({
      name: 'AgentServer',
      slots: [
        $.HTTPServer,
        $.Method.new({
          name: 'templatize',
          do: function templatize(moduleName) {
            return readFileSync('./src/module_template.html').toString().replaceAll('%%MODULE%%', moduleName);
          }
        }),
      ]
    });

    $.AgentServer.new({
      port: 3031,
      slots: [
        $.PathRequestHandler.new({
          path: '/api/chat',
          async handler(app, req, res) {
            const conversation = await req.drain();
            this.log(conversation);
            let completion = await fetch(`${chatConfig.url}/v1/chat/completions`, {
              Method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${chatConfig.key}`,
              },
              body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet',
                messages: conversation,
              }),
            });
            const json = await completion.json();
            res.ok(JSON.stringify(json), 'application/json');
          }
        }),
        $.PathRequestHandler.new({
          path: '/completion',
          handler(app, req, res) {
            res.ok(app.templatize('completion'));
          }
        }),
        $.PathRequestHandler.new({
          path: '/agenda',
          handler(app, req, res) {
            res.ok(app.templatize('agenda'));
          }
        }),
        $.PathRequestHandler.new({
          path: '/bootstrap',
          handler(app, req, res) {
            res.ok(app.templatize('bootstrap'));
          }
        }),
        $.FiletypeRequestHandler.new({
          filetypes: ['js'],
          mimeType: 'application/javascript',
        }),
        $.FiletypeRequestHandler.new({
          filetypes: ['css'],
          mimeType: 'text/css',
        })
      ]
    });
  }
}).load();
