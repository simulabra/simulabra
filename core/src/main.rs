use err::SlabErr;
use err::SlabResult;
use model::Model;
use pyo3::prelude::*;
use pyo3::PyResult;
pub mod model;
pub mod agent;
pub mod err;
pub mod pylib;

fn main() -> SlabResult<()> {
    let load_res = Model::load_local();
    if let Err(e) = load_res {
        match e {
            SlabErr::Msg(m) => eprintln!("Error: {}", m),
            SlabErr::Py(p) => {
                Python::with_gil(|py| {
                    eprintln!("Python error:");
                    p.print(py);
                })
            },
            SlabErr::IO(io) => eprintln!("IO Error: {}", io),
        };
    }
    Ok(())
}
