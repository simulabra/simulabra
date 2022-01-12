use std::collections::HashMap;
use std::rc::{Weak, Rc};
use std::fmt::Debug;

use pyo3::{prelude::*, PyClass, types::{PyType, PyFunction}};

#[derive(Debug)]
pub struct AgentDefinition {
    pub name: String,
    pub components: Vec<ComponentName>,
    pub params: Params,
    pub vars: Vars,
    pub actions: Actions,
    pub action_handlers: ActionHandlers,
}

impl AgentDefinition {
    pub fn instantiate(&self) -> Agent {
        Agent
    }
}

pub struct Agent;
