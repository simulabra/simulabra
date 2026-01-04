#!/usr/bin/env bun
import { __, base } from 'simulabra';
import live from 'simulabra/live';
import * as readline from 'readline';

await async function (_, $, $live) {
  $.Class.new({
    name: 'AgendaCLI',
    doc: 'Command-line interface for Agenda',
    slots: [
      $live.NodeClient,
      $.Var.new({ name: 'geistProxy' }),
      $.Var.new({ name: 'supervisorUrl', default: 'ws://localhost:3030' }),

      $.Method.new({
        name: 'connectToSupervisor',
        doc: 'connect to the supervisor and get GeistService proxy',
        async do() {
          // NodeClient.connect() uses SIMULABRA_PORT
          const port = process.env.AGENDA_PORT || process.env.SIMULABRA_PORT || 3030;
          process.env.SIMULABRA_PORT = port;

          await this.connect();
          this.geistProxy(await this.serviceProxy({ name: 'GeistService' }));
          this.tlog('connected to GeistService');
        }
      }),

      $.Method.new({
        name: 'interpret',
        doc: 'send input to GeistService and return response',
        async do(input) {
          if (!this.geistProxy()) {
            throw new Error('Not connected to GeistService');
          }
          return await this.geistProxy().interpret(input);
        }
      }),

      $.Method.new({
        name: 'formatResponse',
        doc: 'format the response for display',
        do(result) {
          if (!result.success) {
            return `Error: ${result.error}`;
          }

          let output = result.response || '';

          if (result.toolsExecuted && result.toolsExecuted.length > 0) {
            for (const tool of result.toolsExecuted) {
              if (!tool.result.success) {
                output += `\n[${tool.tool}] Error: ${tool.result.error}`;
              }
            }
          }

          return output.trim() || 'Done.';
        }
      }),

      $.Method.new({
        name: 'runOnce',
        doc: 'run a single command and exit',
        async do(input) {
          try {
            await this.connectToSupervisor();
            const result = await this.interpret(input);
            console.log(this.formatResponse(result));
            process.exit(0);
          } catch (e) {
            console.error(`Error: ${e.message}`);
            process.exit(1);
          }
        }
      }),

      $.Method.new({
        name: 'runRepl',
        doc: 'run interactive REPL mode',
        async do() {
          try {
            await this.connectToSupervisor();
            console.log('Agenda - Personal Productivity Assistant');
            console.log('Type your request, or "quit" to exit.\n');

            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
            });

            const prompt = () => {
              rl.question('> ', async (input) => {
                input = input.trim();

                if (!input) {
                  prompt();
                  return;
                }

                if (input === 'quit' || input === 'exit' || input === 'q') {
                  console.log('Goodbye!');
                  rl.close();
                  process.exit(0);
                  return;
                }

                try {
                  const result = await this.interpret(input);
                  console.log('\n' + this.formatResponse(result) + '\n');
                } catch (e) {
                  console.error(`Error: ${e.message}\n`);
                }

                prompt();
              });
            };

            prompt();
          } catch (e) {
            console.error(`Error: ${e.message}`);
            process.exit(1);
          }
        }
      }),
    ]
  });

  // Parse command line args
  const args = process.argv.slice(2);
  const isInteractive = args.includes('-i') || args.includes('--interactive');
  const input = args.filter(a => !a.startsWith('-')).join(' ');

  const cli = _.AgendaCLI.new({ uid: 'AgendaCLI' });

  if (isInteractive || !input) {
    await cli.runRepl();
  } else {
    await cli.runOnce(input);
  }
}.module({
  name: 'agenda.cli',
  imports: [base, live],
}).load();
