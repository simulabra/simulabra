import { __, base } from '../src/base.js';
import pm from '../src/pm.js';

await async function (_, $, $pm) {
  $.Class.new({
    name: 'CLI',
    doc: 'command line interface for simulabractl',
    slots: [
      $.Var.new({ name: 'controller' }),
      $.Var.new({ name: 'args', default: () => [] }),
      $.Var.new({ name: 'options', default: () => ({}) }),
      $.After.new({
        name: 'init',
        do() {
          this.parseArgs();
        }
      }),
      $.Method.new({
        name: 'parseArgs',
        do() {
          const args = process.argv.slice(2);
          const options = {};
          const positional = [];

          for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
              const key = arg.slice(2);
              if (key.includes('=')) {
                const [k, v] = key.split('=');
                options[k] = v;
              } else if (args[i + 1] && !args[i + 1].startsWith('-')) {
                options[key] = args[++i];
              } else {
                options[key] = true;
              }
            } else if (arg.startsWith('-')) {
              options[arg.slice(1)] = true;
            } else {
              positional.push(arg);
            }
          }

          this.args(positional);
          this.options(options);
        }
      }),
      $.Method.new({
        name: 'createController',
        do() {
          const opts = this.options();
          return $pm.PMController.new({
            configPath: opts.config || 'misc/pm/services.js',
            paths: $pm.PMPaths.new({
              stateDir: opts['pm-dir'] || 'tmp/pm',
              logDir: opts['log-dir'] || 'logs/pm',
            }),
          });
        }
      }),
      $.Method.new({
        name: 'run',
        async do() {
          const [command, ...rest] = this.args();
          const ctrl = this.createController();

          switch (command) {
            case 'list':
            case 'ls':
              return this.cmdList(ctrl);
            case 'start':
              return this.cmdStart(ctrl, rest);
            case 'stop':
              return this.cmdStop(ctrl, rest);
            case 'restart':
              return this.cmdRestart(ctrl, rest);
            case 'logfile':
            case 'log':
              return this.cmdLogfile(ctrl, rest);
            case 'help':
            case undefined:
              return this.cmdHelp();
            default:
              console.error(`Unknown command: ${command}`);
              return this.cmdHelp(1);
          }
        }
      }),
      $.Method.new({
        name: 'cmdList',
        async do(ctrl) {
          const result = await ctrl.list({ json: this.options().json });
          if (this.options().json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(result);
          }
          return 0;
        }
      }),
      $.Method.new({
        name: 'cmdStart',
        async do(ctrl, services) {
          if (services.length === 0) {
            console.error('Usage: simulabractl start <service>...');
            return 1;
          }

          let exitCode = 0;
          for (const name of services) {
            const result = await ctrl.start(name);
            if (!this.options().quiet) {
              console.log(result.message);
            }
            if (!result.success) {
              exitCode = result.code;
            }
          }
          return exitCode;
        }
      }),
      $.Method.new({
        name: 'cmdStop',
        async do(ctrl, services) {
          if (services.length === 0) {
            console.error('Usage: simulabractl stop <service>');
            return 1;
          }

          const [name] = services;
          const result = await ctrl.stop(name, {
            force: this.options().force,
            timeout: this.options().timeout ? parseInt(this.options().timeout) : undefined,
          });
          if (!this.options().quiet) {
            console.log(result.message);
          }
          return result.success ? 0 : result.code;
        }
      }),
      $.Method.new({
        name: 'cmdRestart',
        async do(ctrl, services) {
          if (services.length === 0) {
            console.error('Usage: simulabractl restart <service>');
            return 1;
          }

          const [name] = services;
          const result = await ctrl.restart(name, {
            force: this.options().force,
            timeout: this.options().timeout ? parseInt(this.options().timeout) : undefined,
          });
          if (!this.options().quiet) {
            console.log(result.message);
          }
          return result.success ? 0 : result.code;
        }
      }),
      $.Method.new({
        name: 'cmdLogfile',
        async do(ctrl, services) {
          if (services.length === 0) {
            console.error('Usage: simulabractl logfile <service>');
            return 1;
          }

          const [name] = services;
          const result = await ctrl.logfile(name);
          if (result.success) {
            console.log(result.path);
            return 0;
          }
          console.error(result.message);
          return result.code;
        }
      }),
      $.Method.new({
        name: 'cmdHelp',
        do(exitCode = 0) {
          console.log(`Simulabra Process Manager (SPM)

Usage: simulabractl <command> [options]

Commands:
  list, ls                    List all services and their status
  start <service>...          Start one or more services
  stop <service>              Stop a service
  restart <service>           Stop then start a service
  logfile <service>           Print the log file path
  help                        Show this help message

Options:
  --config <path>             Service registry path (default: misc/pm/services.js)
  --pm-dir <path>             State directory (default: tmp/pm)
  --log-dir <path>            Log directory (default: logs/pm)
  --json                      Output in JSON format (list command)
  --quiet, -q                 Suppress output messages
  --force                     Force stop (SIGKILL after timeout)
  --timeout <ms>              Stop timeout in milliseconds

Exit Codes:
  0    Success
  2    Unknown service
  3    Service not running
  4    Start failed
  5    Stop timeout`);
          return exitCode;
        }
      }),
    ]
  });

  if (require.main === module) {
    const cli = _.CLI.new();
    const exitCode = await cli.run();
    process.exit(exitCode);
  }
}.module({
  name: 'simulabractl',
  imports: [base, pm],
}).load();
