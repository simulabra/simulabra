import { __, base } from '../src/base.js';
import pm from '../src/pm.js';

await async function (_, $, $pm) {
  if (require.main === module) {
    const serviceName = process.argv[2];
    if (!serviceName) {
      console.error('Usage: pm-runner.js <service-name>');
      process.exit(1);
    }

    const configPath = process.env.PM_CONFIG || 'misc/pm/services.js';
    const stateDir = process.env.PM_STATE_DIR || 'tmp/pm';
    const logDir = process.env.PM_LOG_DIR || 'logs/pm';

    const registry = await $pm.PMRegistry.load(configPath);
    const service = registry.get(serviceName);
    if (!service) {
      console.error(`Unknown service: ${serviceName}`);
      process.exit(2);
    }

    const paths = $pm.PMPaths.new({ stateDir, logDir });
    const runner = $pm.PMRunner.new({ service, paths });
    await runner.start();
  }
}.module({
  name: 'pm-runner',
  imports: [base, pm],
}).load();
