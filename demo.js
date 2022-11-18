import Base from './base';

const _Demo = Base.Class.new({
  _name: Base.$$`Demo`,
  _slots: {
    render() {
      return '<h1>hello from simulabra !</h1>';
    }
  }
});

const _ = Base.Module.new({
  _exports: [
    _Demo,
  ],
});

export default _;
