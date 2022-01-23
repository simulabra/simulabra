use std::fmt::Debug;

#[derive(Debug)]
pub enum SimulabraType {
    Number,
    String,
    Bool,
    Agent,
}

#[derive(Debug)]
pub struct Identifier(String);

#[derive(Debug)]
pub struct VarDefinition {
    identifier: Identifier,
    ttype: SimulabraType,

}

#[derive(Debug)]
pub struct ClassName(String);


#[derive(Debug)]
pub struct ClassDefinition {
    pub name: ClassName,
    // whether this can be instantiated as an agent
    pub agent: bool,
    // composition over inheritance!
    pub components: Vec<ClassName>,
}
