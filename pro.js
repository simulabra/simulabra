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
    } else {
      return evs(obj.class, 'find', msg);
    }
  },

  ev(it) {
    if (classeq(it, 'Send')) {
      let recv = ev(it.recv);
      let slot = lookup(recv, it.$msg);
      if (!nil(slot)) {
        return slot
      } else {

      }
    } else {

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

    Var: {
      extend: 'Slot',
      slots: {
        type: 'Class',
        val: 'Any',
        handle(arg) {
          if (nil(arg)) {
            return this.val;
          } else {
            this.val = arg;
            return this.val;
          }
        }
      }
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
