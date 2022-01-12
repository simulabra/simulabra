use std::path::PathBuf;

use err::SlabErr;
use err::SlabResult;
use model::Model;
use pyo3::prelude::*;
use pyo3::PyResult;
use clap::Parser;
pub mod model;
pub mod agent;
pub mod err;
pub mod pylib;
pub mod lang;

#[derive(Parser, Debug)]
struct SlabArgs {
    model: Option<PathBuf>,
}
fn main() -> SlabResult<()> {
    let args = SlabArgs::parse();

    if let Some(model) = args.model {
        let load_res = Model::load_local(model);
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
        } else {
            let model = load_res.unwrap();
            println!("{:?}", model);
        }
    }
    Ok(())
}
