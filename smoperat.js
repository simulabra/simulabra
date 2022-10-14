/*
Your task: to construct a better object system on top of Javascript

Ultimately all objects belong to a class.
Type system is like that of Strongtalk, using f-bounded polymorphism. 
The class methods object is used as the instance's prototype
Class methods' prototype is superclass' class methods (side chain?)
Instance can override them locally (it's still prototypical) 
Subject to typechecking (which can be ignored or lied to, at peril!)
Single inheritance with mixins, merged into intermediate anonymous parent
Every object has an identity
*/


// hook up object to class
let $ = {
    defclass(name, cls) {
        cls._name = name;
        this[name] = $.klass.new(cls);
    }
};

$.object = {
    _slots: {
        init() {},
    }
}

$.klass = {
    _slots: {
        _name: '', // non-type, non-slot object => default
        _slots: {},
        _super: $.object,
        _mixins: [],
        new(props = {}) {
            let obj = props;
            // should we clone the default props?
            if (this._mixins.length > 0) {
                let parent = this._mixins.reduce((prev, cur) => {
                    return cur(prev);
                }, {});
                Object.setPrototypeOf(parent, this._slots);
                Object.setPrototypeOf(obj, parent);
            } else {
                Object.setPrototypeOf(obj, this._slots);
            }
            Object.entries(this._slots).forEach(([varName, varVal]) => {
                // need to explicitly copy default value
                if (varName[0] === '_' && varVal instanceof Function) {
                    obj[varName] = varVal();
                }
            });
            obj._class = this;
            obj.init();
            return obj;
        },
        init() {
            Object.setPrototypeOf(this._slots, this._super._slots);
        },
        super() {
            return this._super._slots;
        },
        name() {
            return this._name;
        },
    }
}


Object.setPrototypeOf($.klass, $.klass._slots);

$.symbol = $.klass.new({
    _sympool: {},
    _idc: 0,
    get(name) {
        return this._sympool[name];
    },
    save(id, name) {
        this._sympool[id] = name;
        this._sympool[name] = id;
    },
    sym(name) {
        let gid = $.symbol.get(name);
        if (!gid) {
            gid = $.symbol.genid();
            $.symbol.save(gid, name)
        }
        return this.new({
            _gid: gid,
        });
    },
    genid() {
        return ++this._idc;
    },
    _slots: {
        _gid: null,
        toString() {
            return this.name();
        },
        name() {
            return $.symbol.get(this._gid);
        },
        gid() {
            return this._gid
        },
        eq(other) {
            return this.gid() === other.gid();
        }
    },
});

$.object._name = $.symbol.sym('object');
$.klass._name = $.symbol.sym('class');
$.symbol._name = $.symbol.sym('symbol');

$.defclass('primitive', {

});

// wrap strings numbers booleans etc

$.string = $.klass.new({

})

export { $ };
