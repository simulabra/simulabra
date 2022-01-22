use std::fs::{File, read_dir, self, read_to_string};
use std::io::Read;
use std::ops::Deref;
use std::path::{Path, PathBuf};

use pyo3::types::{PyFunction, PyType, PyBool};
use pyo3::{prelude::*, wrap_pymodule, PyClass};
use pyo3::{Py, PyAny};

use crate::agent::{Agent, AgentDefinition};
use crate::err::{SlabErr, SlabResult};
use crate::pylib::{simulabra_module, locals};

// The beefy boy
#[derive(Debug)]
pub struct Model {
    agents: Vec<AgentDefinition>,
    setup: SetupProcedure,
}

// pub fn load_code(file: PathBuf) -> SlabResult<Py<PyModule>> {

// }

pub fn sim_subclass(py: Python, sim_class: &str, symbol: &PyAny, m: &PyModule) -> bool {
    py.eval(format!("issubclass({}, sim.{})", symbol, sim_class).as_str(), None, Some(m.dict())).map(|p| p.downcast::<PyBool>().unwrap().is_true()).unwrap_or(false)
}

impl Model {
    // pub fn load_from_dir(path: PathBuf) -> Result<Model, SlabErr> {
    //     let setup = SetupProcedure::load()?;
    //     let mut agent_dir = PathBuf::new();
    //     agent_dir.push("agents");
    //     let mut agents = Vec::new();
    //     for af in read_dir(agent_dir)? {
    //         let agent_file = af?;
    //         agents.push(AgentDefinition::new(load_code(agent_file.path())?));
    //     }
    //     Ok(Model {
    //         agents,
    //         setup,
    //     })
    // }
    // pub fn load_local(path: PathBuf) -> Result<Model, SlabErr> {
    //     Python::with_gil(|py| {
    //         let mut agents = Vec::new();
    //         let code = read_to_string(path)?;
    //         let m = PyModule::from_code(py, code.as_str(), "", "")?;
    //         let setup_fn = m.dict().get_item("setup").ok_or(SlabErr::msg("Couldn't find setup function!"))?;
    //         // let sim_mod: &PyModule = m.dict().get_item("sim").ok_or(SlabErr::msg("Couldn't get simulabra library as sim"))?.downcast().unwrap();
    //         // let agent_base: &PyType = sim_mod.dict().get_item("Agent").ok_or(SlabErr::msg("Couldn't get Agent class from sim mod"))?.downcast().unwrap();
    //         for (symbol, value) in m.dict().iter() {
    //             if sim_subclass(py, "Agent", symbol, m) {
    //                 println!("symbol: {} {}", symbol, value);
    //                 agents.push(AgentDefinition {
    //                     class: value.downcast::<PyType>().unwrap().into(),
    //                     name: format!("{}", symbol),
    //                     components: Vec::new(),
    //                 });
    //             }
    //         }
    //         Ok(Model {
    //             agents,
    //             setup: SetupProcedure {
    //                 code: setup_fn.into(),
    //             },
    //         })
    //     })
    // }
}

#[derive(Debug)]
pub struct SetupProcedure {
    code: Py<PyAny>,
}

pub struct Simulation {
    model: Model,
    agents: Vec<Agent>,
    variables: Py<PyModule>,
}
