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

let oObject = {
    _name: 'object',
    _super_level: null,
    _slots: {
        init() {
        },
    }
}

let oClass = {
    _name: 'class', // will be a symbol later
    _slots: {
        _name: '', // non-type, non-slot object => default
        _slots: {},
        _super: oObject,
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
        }
    }
}

Object.setPrototypeOf(oClass, oClass._slots);


export { oObject, oClass };
