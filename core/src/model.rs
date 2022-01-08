use std::fs::{File, read_dir, self, read_to_string};
use std::io::Read;
use std::ops::Deref;
use std::path::{Path, PathBuf};

use pyo3::{prelude::*, wrap_pymodule, PyClass};
use pyo3::{Py, PyAny};

use crate::agent::{Agent, AgentDefinition};
use crate::err::{SlabErr, SlabResult};
use crate::pylib::{simulabra_module, locals};

// The beefy boy
pub struct Model {
    agents: Vec<AgentDefinition>,
    setup: SetupProcedure,
}

pub fn load_code(code: String) -> SlabResult<Py<PyClass>> {
    Python::with_gil(|py| {
        let locals = locals(py);
        let agent_class: Py<PyClass> = py.eval(code.as_str(), None, Some(locals))?.downcast::<PyClass>().unwrap().into();
        Ok(agent_class)
    })
}

impl Model {
    pub fn load_local() -> Result<Model, SlabErr> {
        let setup = SetupProcedure::load()?;
        let mut agent_dir = PathBuf::new();
        agent_dir.push("agents");
        let mut agents = Vec::new();
        for af in read_dir(agent_dir)? {
            let agent_file = af?;
            let agent_code = fs::read_to_string(agent_file.path())?;
            agents.push(AgentDefinition::new(load_code(agent_code)?));
        }
        Ok(Model {
            agents,
            setup,
        })
    }
}

pub struct SetupProcedure {
    code: Py<PyModule>,
}

impl SetupProcedure {
    pub fn load() -> Result<SetupProcedure, SlabErr> {
        let mut path = PathBuf::new();
        path.push("setup.py");
        let setup_code = read_to_string(path)?;
        load_code(setup_code).map(|module| SetupProcedure { code: module })
    }
}

pub struct Simulation {
    model: Model,
    agents: Vec<Agent>,
    variables: Py<PyModule>,
}
