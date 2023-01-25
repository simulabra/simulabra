import { $class, $var, $method, $debug } from './base.js';

export const $module_source = $class.new({
  name: 'module_source',
  static: {
    loadLocal(name) {
      const file = `./core/${name}.simulabra`;
      const source = readFileSync(file).toString();
      return this.new({
        source
      })
    }
  },
  slots: {
    source: $var.new(),
    parser() {
      return $parser.fromSource(this.source());
    },
  }
});

export const $esm_cache = $class.new({
  name: 'esm-cache',
  desc: 'caches esm by content hash of js',
  slots: {
    cache: $var.default(() => ({})),
    hash(js) {
      return 'default'; // so it don't change
      const hash = createHash('md5');
      hash.update(js);
      return hash.digest('base64').replace(/\//g, '_');
    },
    async import(js) {
      const hash = this.hash(js);
      if (this.cache().contains(hash)) {
        return this.cache()[hash];
      } else {
        const path = `./out/${hash}.mjs`;
        writeFileSync(path, js);
        const mod = await import(path);
        this.cache()[hash] = mod;
        return mod;
      }
    }
  }
})

export const $evaluator = $class.new({
  name: 'evaluator',
  slots: {
    ctx: $var.new(),
    run(program) {
      const cache = $esm_cache.new();
      const js = this.prettify(program.estree(this.ctx()));
      return cache.import(js);
    },
    prettify(estree) {
      try {
        return prettyPrint(estree).code.replace(/\\n/g, '\n');
      } catch (e) {
        console.log(JSON.stringify(estree, null, 1));
        throw e;
      }
    }
  }
});

export const $$evl = $evaluator.new({
  ctx: null // TODO:!
});

export const $module = $class.new({
  name: 'module',
  static: {
    loadFromFile(name) {
      const src = $module_source.loadLocal(name);
      const node = $program.parse(src.parser());
      const mod = this.new({
        src,
        node
      });
      $_.mod = mod;
      return $$evl.run(node);
    }
  },
  slots: {
    name: $var.new(),
    classes: $var.default({}),
    functions: $var.default({}),
    src: $var.new(),
    node: $var.new(),
    addClass(cls) {
      this.classes()[cls.name()] = cls;
    },
    addFunction(name, fn) {
      this.functions()[name] = fn;
    },
    test() {
      this.functions().test()
    }
  }
});
