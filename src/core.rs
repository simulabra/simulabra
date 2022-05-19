use std::{collections::{HashMap, BTreeMap}, rc::Rc, sync::{RwLock, Arc}, fmt::Display};

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
    pub fn get(&self) -> &Object {
        match self.frame {
            RefFrame::Frame(_) => todo!(),
            RefFrame::Present => self.context.objects.get(&self.id).unwrap(),
        }

    }
}

pub struct Shape {
    map: HashMap<Symbol, usize>,
    height: usize,
}

impl Shape {
    pub fn transition(&self, name: Symbol) -> Shape {
        let new_map = self.map.clone();
        let height = new_map.values().max().unwrap();
        new_map.insert(name, height + 1);
        Shape {
            map: new_map,
            height: self.height + 1,
        }
    }
}

pub type ShapePtr = Arc<Shape>;

pub struct Object {
    class: ORef,
    shape: ShapePtr,
    slots: Vec<ORef>,
}

impl Object {
    fn slot_index(&self, name: Symbol)-> Option<usize> {
        self.shape.map.get(&name).map(|i| *i)
    }
    pub fn get_slot(&self, name: Symbol) -> ORef {
        if let Some(index) = self.slot_index(name) {
            self.slots[index]
        } else {
            panic!("couldn't find slot and was too lazy to fix myself {}", name.0);
        }
    }
    pub fn set_slot(&mut self, name: Symbol, value: ORef) -> &mut Self {
        if let Some(index) = self.slot_index(name) {
            self.slots[index] = value;
        } else {
            let new_shape = self.shape.transition(name);
            self.shape = Arc::new(new_shape);
            self.slots.push(value);
        }
        self
    }
    pub fn send(&mut self, ctx: &Context, name: Symbol, arg: ORef) -> Option<ORef> {
        let method = ctx.find_method(name, arg);
        if let Some(&slot) = self.slots.get() {

        } else {
            for parent in self.parents {
                if let Some(parent_result) = parent.send(message, args) {

                }
            }
        }
    }
}

pub struct Context {
    cur_frame: Frame,
    objects: BTreeMap<u64, Object>,
    classes: Vec<ORef>,
}

impl Context {
    pub fn find_method(&self, name: Symbol, arg: ORef) -> ORef {

    }
}
