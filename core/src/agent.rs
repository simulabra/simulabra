use std::rc::{Weak, Rc};

use pyo3::{prelude::*, PyClass};

pub struct AgentDefinition {
    code: Py<PyModule>,
}

impl AgentDefinition {
    pub fn new(code: Py<PyModule>) -> Self {
        Self {
            code
        }
    }
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
