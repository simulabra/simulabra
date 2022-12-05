import * as Base from './base.js';

export const CallbackCommand = Base.Class.new({
  name: 'CallbackCommand',
  slots: {
    self: Base.Var.new(),
    fn: Base.Var.new(),
    run: Base.Method.new({
      do(...args) {
        return this.fn().apply(this.self(), args);
      }
    }),
  }
});
