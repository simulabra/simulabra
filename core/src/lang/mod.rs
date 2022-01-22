mod parser;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Val {
    Float(f32),
    Int(isize),
    String(String),
    Ident(Ident),
}

#[derive(Debug, Clone, PartialEq)]
pub enum ValType {
    Float,
    Int,
    String,
    Ident,
    Component(ComponentName),
}

#[derive(Debug, Clone, PartialEq)]
pub struct VarDef {
    is_const: bool,
    typ: ValType,
    default: Option<Val>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Program {
}

#[derive(Debug, Clone, PartialEq)]
pub struct ActionDef {
    name: Ident,
    code: Program,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FactDef {
    name: Ident,
    code: Program,
}

#[derive(Debug, Clone, PartialEq)]
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
