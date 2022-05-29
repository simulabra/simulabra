#![feature(exclusive_range_pattern)]

use std::{fs::read_to_string, io::Error};

use lexer::Lexer;

use crate::parser::{Parser, parse};

mod lexer;
mod parser;
// mod core;

fn main() -> Result<(), Error> {
    let boot = read_to_string("./src/boot.simulabra")?;
    println!("{:?}", parse(boot));
    Ok(())
}
