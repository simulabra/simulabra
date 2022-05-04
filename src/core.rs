use std::{collections::HashMap, sync::{RwLock, Arc}};

pub struct Object {
    class: ObjectRef,
    slots: HashMap<Symbol, ObjectRef>,
}

pub type ObjectRef = Arc<RwLock<Object>>;

impl Object {
    pub fn handle(&self, msg: Symbol) {

    }

    pub fn wrap(self) -> ObjectRef {
        Arc::new(RwLock::new(self))
    }
}
pub struct T {
    recv: ObjectRef,
    msg: Symbol,
    it: Expr,
}

pub struct Symbol(String);

pub enum Expr {
    Number(f32),
    Symbol(Symbol),
    List(Vec<Expr>),
    Map(HashMap<Symbol, Expr>),
    T(T),
    Nil,
}

impl Expr {
    fn eval(&self, e: &Env) -> ObjectRef {
        match self {
            Expr::Number(n) => e.find("Number"),
            Expr::Symbol(s) => todo!(),
            Expr::List(l) => todo!(),
            Expr::Map(m) => todo!(),
            Expr::T(t) => todo!(),
            Expr::Nil => todo!(),
        }
    }
}

pub struct Env {
    binds: HashMap<Symbol, ObjectRef>,
}

impl Env {
    pub fn base() -> Self {
        let mut binds = HashMap::new();
        let class = Object {
            class: Box::new_uninit(),
            slots: HashMap::new(),
        }.wrap();
        // metacircular, bro
        class.write().unwrap().class = class;
        binds.insert("Class", class);
        return Self {
            binds
        }
    }
}
