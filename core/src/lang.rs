use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Val {
    Float(f32),
    Int(isize),
    String(String),
    Ident(Ident),
}

pub enum ValType {
    Float,
    Int,
    String,
    Ident,
    Component(ComponentName),
}

pub struct VarDef {
    is_const: bool,
    typ: ValType,
    default: Option<Val>,
}

pub struct Program {
}

pub struct ActionDef {
    name: Ident,
    code: Program,
}

pub struct FactDef {
    name: Ident,
    code: Program,
}

pub struct ActionHandlerDef {
    name: Ident,
    code: Program,
}

#[derive(Debug, PartialEq, Hash, Clone)]
pub struct Ident(String);

#[derive(Debug, PartialEq, Hash, Clone)]
pub struct ComponentName(String);

#[derive(Debug)]
pub struct ComponentDef {
    pub name: ComponentName,
    pub requirements: Vec<ComponentName>,
    pub vars: Vec<VarDef>,
    pub facts: Vec<FactDef>,
    pub actions: Vec<ActionDef>,
    pub action_handlers: Vec<ActionHandlerDef>,
}
