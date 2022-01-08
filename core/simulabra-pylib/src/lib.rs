use pyo3::prelude::*;
use pyo3::types::{PyDict, PyType};
use pyo3::wrap_pymodule;

#[pyclass]
struct Model {
    components: Vec<Py<PyType>>,
}

#[pyclass]
struct Config {

}

#[pyclass]
struct Position {
    x: i32,
    y: i32,
}

#[pyclass]
struct Shape {

}

#[pymodule]
fn simulabra(py: Python, m: &PyModule) -> PyResult<()> {
    m.add_class::<Model>()?;
    m.add_class::<Config>()?;
    m.add_class::<Position>()?;
    m.add_class::<Shape>()?;
    // m.add_wrapped(wrap_pymodule!(submodule))?;

    // Inserting to sys.modules allows importing submodules nicely from Python
    // e.g. from maturin_starter.submodule import SubmoduleClass

    // let sys = PyModule::import(py, "sys")?;
    // let sys_modules: &PyDict = sys.getattr("modules")?.downcast()?;
    // sys_modules.set_item("maturin_starter.submodule", m.getattr("submodule")?)?;

    Ok(())
}
