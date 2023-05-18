import { existsSync } from 'fs';

export async function resolve(specifier, context, next) {
  if (specifier.indexOf('simulabra/') === 0) {
    let modName = specifier.replace('simulabra/', '');
    try {
      if (existsSync(`${modName}.js`)) {
        return {
          format: 'url',
          url: `file:///${process.cwd()}/${modName}.js`
        };
      } else {
        if (modName.indexOf('/') === -1) {
          modName = 'core/' + modName;
        }
        const cache = globalThis.SIMULABRA.mod().find('class', 'module-cache').inst();
        if (!cache.hashed(modName)) {
          await cache.load_module(modName);
        }
        const hash = cache.module_hashes()[modName];
        return {
          format: 'url',
          url: `file:///${process.cwd()}/out/${hash}.mjs`
        };
      }
    } catch (e) {
      console.log('failed to resolve');
      console.error(e);
      throw new Error(`esm loader resolve failed for '${modName}'!!`);
    }
  } else {
    return next(specifier, context);
  }
}
