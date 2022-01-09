use std::rc::{Weak, Rc};
use std::fmt::Debug;

use pyo3::{prelude::*, PyClass, types::{PyType, PyFunction}};

pub trait Component: Debug {
    fn step(&self);
}

#[derive(Debug)]
pub enum ComponentDesc {
    Python(Py<PyType>),
    Native(Box<dyn Component>),
}

#[derive(Debug)]
pub struct AgentDefinition {
    pub name: String,
    pub class: Py<PyType>,
    pub components: Vec<ComponentDesc>,
}

impl AgentDefinition {
}
