/**
 * String as symbol - everything defined is lazy evaled? and strings lookup classes?
 */
const env = {
  s(recv, $msg, $arg = null) {
    return {
      class: 'Send',
      recv,
      $msg,
      $arg
    };
  },

  nil(arg) {
    return arg === null;
  },

  findclass(obj) {
    if ('class' in obj) {
      return obj.class;
    } else if (obj === null) {
      return 'Null';
    } else if (typeof obj === 'number') {
      return 'Number';
    }
  },

  classeq(obj, cls) {
    return this.findclass(obj) === cls;
  },

  lookup(obj, msg) {
    if (msg in obj) {
      return obj[msg];
    } else if ('class' in obj) {
      return this.find(obj.class, msg);
    } else {
      return null;
    }
  },

  find(cls, msg) {
    if (msg in cls.slots) {
      return cls.slots[msg];
    } else if (cls.extend) {
      return this.find(this.ev(cls.extend), msg);
    } else {
      return null;
    }
  },

  send(recv, msg, args) {
    let slot = lookup(recv, msg);
    if (!nil(slot)) {
      if (typeof slot === 'function') {
        return slot.apply(recv, args);
      } else {
        return slot;
      }
    } else {
      throw new Error('invalid message ' + msg);
    }
  },

  ev(it) {
    if (Array.isArray(it)) {

    }
  },

  newvar(typ, val = null) {
    return {
      class: 'Var',
      type: typ,
      val: s(val, 'or', ev(s(typ, 'default'))),
    }
  },

  classes: {
    Null: {
      class: 'Class',
      name: 'Null',
      slots: {
        or(arg) {
          return this.ev(arg);
        }
      }
    },

    Slot: {
      class: 'Class',
      name: 'Slot',
      slots: {
        type: 'Class',
        handle: {
          class: 'Method',
          arg: 'Any?',
          ret: 'type',
        }
      }
    },
    Var: {
      class: 'Class',
      extend: 'Slot',
      slots: {
        val: 'type',
        handle: {
          class: 'Method',
          arg: 'Any?',
          ret: 'type',
          do(arg) {
            if (nil(arg)) {
              return this.val;
            } else {
              this.val = arg;
              return this.val;
            }
          }
        }
      }
    },
    Method: {
      class: 'Class',
      extend: 'Slot',
      name: 'Method',
      slots: {
        arg: 'Class',
        ret: 'Class',
        do: 'Object', // function
        handle: {
          do(arg) {
            return this.do(arg); // ???
          }
        },
      },
    },

    Class: {
      name: 'Class',
      slots: {
        name: 'String',
        slots: s('Map', 'of', 'Slot')
      }
    },
  }
};
env.Class.class = Class;
