use pyo3::{prelude::*, types::{PyDict, IntoPyDict}, wrap_pymodule};

#[pyclass]
pub struct Model {

}

#[pymodule]
#[pyo3(name = "simulabra")]
pub fn simulabra_module(py: Python, m: &PyModule) -> PyResult<()> {
    m.add_class::<Model>()?;
    Ok(())
}

pub fn locals<'a>(py: Python<'a>) -> &'a PyDict {
    [(
        "sim", wrap_pymodule!(simulabra)(py),
    )].into_py_dict(py)
}
