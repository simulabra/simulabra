import { run, bench } from 'mitata';
import './base.js';

class Basic {
  _n = 0;

  a(n) {
    this._n += n;
  }

  b(n) {
    this._n -= n / 2;
  }
}

const p1 = {
  a(n) {
    this._n += n;
  }
};

const p2 = {
  b(n) {
    this._n -= n / 2;
  }
};

const direct = {
  _n: 0,
  a(n) {
    this._n += n;
  },
  b(n) {
    this._n -= n / 2;
  }
}

function directProto() {
  return Object.create(direct);
}

function sd(...protos) {
  const p = {};
  for (const proto of protos) {
    for (const [k, v] of Object.entries(proto)) {
      p[k] = v;
    }
  }
  return p;
}

const sdp = sd(p1, p2);

const sdo = function() {
  return Object.create(sdp);
}

function md(...protos) {
  return new Proxy({ n: 0, _protos: protos }, {
    get(target, p) {
      if (p in target) {
        return target[p];
      }
      for (const proto of target._protos) {
        if (p in proto) {
          return proto[p];
        }
      }
    }
  });
}

const mdp = md(p1, p2);

const mdo = function() {
  return Object.create(mdp);
}


function sweat(p) {
  p._n = 0;
  for (var i = 0; i < 100000; i++) {
    p.a(i);
    p.b(i);
  }
  if (p._n !== 2499975000) {
    console.log('BAD p YO ', p._n);
  }
}

const __ = globalThis.SIMULABRA;
const _ = __.mod().find('class', 'module').new({
  name: 'protobench',
  imports: [__.mod()],
});
const $ = _.proxy('class');
$.class.new({
  name: 'p',
  components: [
    $.var.new({ name: 'n' }),
    $.method.new({
      name: 'a',
      do(n) {
        this.n(this.n() + n);
      }
    }),
    $.method.new({
      name: 'b',
      do(n) {
        this.n(this.n() - (n / 2));
      }
    }),
  ]
});

$.class.new({
  name: 'popt',
  components: [
    $.var.new({ name: 'n' }),
    $.method.new({
      name: 'a',
      direct: true,
      do(n) {
        this._n = (this._n + n); // optimization for as long as the var is basic?
      }
    }),
    $.method.new({
      name: 'b',
      direct: true,
      do(n) {
        this._n = (this._n - (n / 2));
      }
    }),
  ]
});

bench('native', () => sweat(new Basic));
bench('single', () => sweat(sdo()));
bench('multiple', () => sweat(mdo()));
bench('direct', () => sweat(direct));
bench('directproto', () => sweat(directProto()));
bench('simulabra', () => sweat($.p.new()));
bench('simulabra-opt', () => sweat($.popt.new()));

await run();
