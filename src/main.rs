#![feature(exclusive_range_pattern)]

use lexer::Lexer;

pub mod lexer;

fn main() {
    let mut lex = Lexer::new("(average 123 234.56) ; an example".to_string());
    let tokens = lex.tokens().unwrap();
    println!("{:?}", tokens);
}
