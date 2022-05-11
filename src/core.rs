use std::{collections::{HashMap, BTreeMap}, rc::Rc};

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

pub struct Map {
    inner: HashMap<Symbol, ORef>,
    /// structural type
    stype: HashMap<Symbol, ORef>,
    /// value type
    vtype: ORef,
}

impl Map {
    pub fn new() -> Self {
        Self {
            inner: Default::default(),
            stype: Default::default(),
            vtype: ORef::new(1),
        }
    }

    pub fn get(&self, sym: &Symbol) -> Option<&ORef> {
        self.inner.get(sym)
    }
}

pub struct Object {
    parents: Vec<ORef>,
    slots: Map,
}

impl Object {
    pub fn send(&mut self, message: Symbol, args: ORef) -> Option<ORef> {
        if let Some(&slot) = self.slots.get(&message) {

        } else {
            for parent in self.parents {
                if let Some(parent_result) = parent.send(message, args) {

                }
            }
        }
    }
}

pub struct ObjectDiff {
    frame: Frame,
    object: ORef,
    changes: Map,
}

pub struct Context {
    cur_frame: Frame,
    objects: BTreeMap<u64, Object>,
    classes: Map,
}

impl Context {

}
