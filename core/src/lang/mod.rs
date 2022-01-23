mod parser;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Val {
    Number(f32),
    String(String),
    Ident(Ident),
}

#[derive(Debug, Clone, PartialEq)]
pub enum ValType {
    Number,
    String,
    Ident,
    Class(ClassName),
}

pub enum Expr {

}

#[derive(Debug, PartialEq, Hash, Clone)]
pub struct Ident(String);

#[derive(Debug, Clone, PartialEq)]
pub struct ClassName(String);


#[derive(Debug)]
pub struct ClassDefinition {
    pub name: ClassName,
    // whether this can be instantiated as an agent
    pub agent: bool,
    // composition over inheritance!
    pub components: Vec<ClassName>,
    pub vars: Vec<VarDef>,
    pub actions: Vec<ActionDef>,
    pub facts: Vec<FactDef>,
    pub handlers: Vec<ActionHandlerDef>,
}

#[derive(Debug)]
pub struct VarDef {
    identifier: Ident,
    ttype: ValType,
    default: Option<Val>,
}


#[derive(Debug, Clone, PartialEq)]
pub struct ActionDef {
    name: Ident,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FactDef {
    name: Ident,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ActionHandlerDef {
    name: Ident,
}
