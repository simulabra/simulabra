import { Class, Var, Method, Interface } from './base.js';

export const $Command = Interface.new({
  name: '$Command',
  slots: {
    do: Var.new(),
  }
});

export const CallbackCommand = Class.new({
  name: 'CallbackCommand',
  slots: {
    self: Var.new(),
    fn: Var.new(),
    run: Method.new({
      do(...args) {
        return this.fn().apply(this.self(), args);
      }
    }),
  }
});
