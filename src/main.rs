use std::path::PathBuf;

use err::SlabResult;
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
    }
    Ok(())
}