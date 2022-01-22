use std::fmt::Debug;

#[derive(Debug)]
pub struct AgentDefinition {
    pub name: String,
}

impl AgentDefinition {
    pub fn instantiate(&self) -> Agent {
        Agent
    }
}

pub struct Agent;
