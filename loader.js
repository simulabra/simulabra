export async function resolve(specifier, context, next) {
  if (specifier.indexOf('simulabra') === 0) {
    const [_trash, modName] = specifier.split('/');
    const __ = globalThis.SIMULABRA;
    try {
      const mod = __.mod().find('module', modName);
      const hash = __.mod().find('class', 'module-cache').inst().module_hash(modName);
      return {
        format: 'url',
        url: `file:///${process.cwd()}/${modName}.js`
      };
      // or .simulabra file!!
    } catch (e) {
      __.log('failed to resolve');
      console.error(e);
      throw new Error(`esm loader resolve failed for '${modName}'!!`);
    }
  } else {
    return next(specifier, context);
  }
}
