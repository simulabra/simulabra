use std::path::PathBuf;

use err::SlabResult;
use clap::Parser;
use lang::parser::parse;
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
    parse();
    Ok(())
}
