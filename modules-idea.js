globalThis.simulabra = {
  Module: Base.Class.new({
    name: 'Module',
    slots: {
      define(obj) {

      }
    }
  }),
  Web: {},
};
const $ = globalThis.simulabra;
const _ = $.Module.new({
  name: 'Web'
});

function defer(fn) {
  return fn();
}

_.define(Base.Class.new({
  name: 'WebSocketRequest',
  super: defer(() => _.Request)
}));
