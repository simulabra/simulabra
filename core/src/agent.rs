use std::rc::{Weak, Rc};

use pyo3::{prelude::*, PyClass, types::PyType};

#[derive(Debug)]
pub struct AgentDefinition {
    pub name: String,
    pub class: Py<PyType>,
}

impl AgentDefinition {
}

pub struct Agent {
    definition: Weak<AgentDefinition>,
    loaded_code: Py<PyAny>,
}

impl Agent {
    pub fn step(&self) {

    }
}

pub struct Position {
    x: f32,
    y: f32,
}
