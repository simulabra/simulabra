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

pub fn load_code(file: PathBuf) -> SlabResult<Py<PyModule>> {
    Python::with_gil(|py| {
        let code = read_to_string(file)?;
        let m = PyModule::from_code(py, code.as_str(), "", "")?;
        println!("symbols: {}", m.dict());
        Ok(m.into())
    })
}

impl Model {
    pub fn load_from_dir(path: PathBuf) -> Result<Model, SlabErr> {
        let setup = SetupProcedure::load()?;
        let mut agent_dir = PathBuf::new();
        agent_dir.push("agents");
        let mut agents = Vec::new();
        for af in read_dir(agent_dir)? {
            let agent_file = af?;
            agents.push(AgentDefinition::new(load_code(agent_file.path())?));
        }
        Ok(Model {
            agents,
            setup,
        })
    }
    pub fn load_local(path: PathBuf) -> Result<Model, SlabErr> {
        let module = load_code(path)?;
        Err(SlabErr::Msg("Not done yet".to_string()))
    }
}

pub struct SetupProcedure {
    code: Py<PyModule>,
}

impl SetupProcedure {
    pub fn load() -> Result<SetupProcedure, SlabErr> {
        let mut path = PathBuf::new();
        path.push("setup.py");
        load_code(path).map(|module| SetupProcedure { code: module })
    }
}

pub struct Simulation {
    model: Model,
    agents: Vec<Agent>,
    variables: Py<PyModule>,
}
