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
    _: {
        name: 'Object',
        methods: {
            clone() {
                return { _: this._.clone() };
            }
        }

    }
}

let oClass = {
    _: {
        name: 'Class', // will be a symbol later    
        vars: {
            name: '', // non-type, non-slot object => default
            vars: {},
            defaults: {},
            methods: {},
            super: oObject,
            mixins: [],
        },
        methods: {
            new(props = {}) {
                let obj = {};
                // should we clone the default props?
                Object.setPrototypeOf(obj, this._.methods);
                obj._ = props;
                Object.entries(this._.vars).forEach(([varName, varVal]) => {
                    if (varVal instanceof Function) {
                        obj._[varName] = varVal();
                   
 }
                });
                Object.setPrototypeOf(obj._, this._.vars);
                obj._.class = this;
                return obj;
            }
        }

    }
}

Object.setPrototypeOf(oClass, oClass._.methods);


export { oObject, oClass };
