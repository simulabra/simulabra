use std::{collections::{HashMap, BTreeMap}, rc::{Rc, Weak}, sync::{RwLock, Arc}, fmt::Display};
use std::hash::Hash;

use crate::parser::SourceExpression;

#[derive(PartialEq, Eq, Clone, Hash)]
pub struct Symbol(String);
#[derive(PartialEq, Eq, Clone)]
pub struct Frame(Vec<u64>);

#[derive(PartialEq, Eq, Clone)]
pub enum RefFrame {
    Frame(Frame),
    Present,
}

#[derive(Clone)]
pub struct ORef {
    id: u64,
    frame: RefFrame,
    node: u64,
    context: Rc<Context>,
}

impl PartialEq for ORef {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id && self.frame == other.frame && self.node == other.node
    }
}

impl ORef {
    pub fn new(n: u64, context: Rc<Context>) -> ORef {
        ORef {
            id: n,
            frame: RefFrame::Present,
            node: 0,
            context,
        }
    }
}

pub struct Shape {
    map: HashMap<Symbol, usize>,
    height: usize,
}

impl Shape {
    pub fn transition(&self, name: Symbol) -> Shape {
        let mut new_map = self.map.clone();
        let height = new_map.values().max().unwrap();
        new_map.insert(name, height + 1);
        Shape {
            map: new_map,
            height: self.height + 1,
        }
    }
}

pub type ShapePtr = Arc<Shape>;

pub struct Method {
    name: Symbol,
    receiver: ClassPtr,
    it: Option<ClassPtr>,
    ret: Option<ClassPtr>,
    code: SourceExpression,
}

impl Method {
    pub fn run(&self, ctx: &Context, receiver: ORef, it: ORef) -> ORef {
       receiver
    }
}

pub trait Receiver {
    fn handle(message: Symbol, it: ORef, args: HashMap<Symbol, ORef>);
}

pub struct VMap<K: Eq + Hash, V> {
    map: HashMap<K, usize>,
    store: Vec<V>
}

impl<K: Eq + Hash, V> VMap<K, V> {
    pub fn get_index(&self, key: &K) -> Option<usize> {
        self.map.get(key).map(|n| *n)
    }
}

pub struct SlotDef {
    slot_type: ClassPtr,
}

pub struct Class {
    name: Symbol,
    slot_defs: VMap<Symbol, SlotDef>,
}

impl PartialEq for Class {
    fn eq(&self, other: &Self) -> bool {
        self.name == other.name
    }
}

pub type ClassPtr = Arc<Class>;

pub enum SimulabraErr {
    MethodMissing(Symbol),
}

pub struct Object {
    id: u64,
    class: ClassPtr,
    slots: Vec<ORef>,
}

impl Object {
    fn slot_index(&self, name: &Symbol)-> Option<usize> {
        self.class.slot_defs.get_index(&name)
    }
    pub fn get_slot_index(&self, idx: usize) -> ORef {
        self.slots[idx].clone()
    }
    pub fn get_slot(&self, name: &Symbol) -> Result<ORef, SimulabraErr> {
        self.slot_index(name).map(|idx| self.get_slot_index(idx)).ok_or_else(|| SimulabraErr::MethodMissing(name.clone()))
    }
    pub fn set_slot_index(&mut self, idx: usize, value: ORef) {
        self.slots[idx] = value;
    }
    pub fn set_slot(&mut self, name: &Symbol, value: ORef) -> Result<(), SimulabraErr> {
        self.slot_index(name).map(|idx| self.set_slot_index(idx, value)).ok_or_else(|| SimulabraErr::MethodMissing(name.clone()));
        Ok(())
    }
    pub fn send(&mut self, ctx: &Context, name: &Symbol, arg: ORef) -> Option<ORef> {
        let method = ctx.find_method(name, arg);
        None
    }
}

pub struct Context {
    cur_frame: Frame,
    objects: BTreeMap<u64, Rc<Object>>,
    classes: Vec<ORef>,
}

impl Context {
    pub fn find_method(&self, name: &Symbol, arg: ORef) {

    }

    pub fn get_oref(&self, oref: ORef) -> Option<Weak<Object>> {
        self.objects.get(&oref.id).map(|obj| Rc::downgrade(obj))
    }
}
