use std::collections::HashMap;

use crate::lexer::Token;

#[derive(Debug)]
pub enum SymbolKind {
    Type,
    Message,
    Vau,
}

#[derive(Debug)]
pub struct Symbol {
    kind: SymbolKind,
    value: String,
}

impl Symbol {
    pub fn type_name(value: String) -> Self {
        Self {
            kind: SymbolKind::Type,
            value
        }
    }
    pub fn message(value: String) -> Self {
        Self {
            kind: SymbolKind::Message,
            value
        }
    }
    pub fn vau(value: String) -> Self {
        Self {
            kind: SymbolKind::Vau,
            value
        }
    }
}

pub type KeyValueMap<T> = HashMap<Symbol, T>;

#[derive(Debug)]
pub enum SourceExpression {
    Symbol(Symbol),

    Object(String, KeyValueMap<SourceExpression>),
    List(Vec<SourceExpression>),
    Send(Box<SourceExpression>, Symbol, Option<Box<SourceExpression>>, Option<KeyValueMap<SourceExpression>>)
}

peg::parser!{
    grammar simulabra_parser() for str {
        rule whitespace()
            = " " / "\n"
        pub rule expression() -> SourceExpression
            = list()

        pub rule list() -> SourceExpression
            = "[" l:(expression() ** whitespace()) "]" { SourceExpression::List(l) }

        rule upper() -> char
            = ['A'..='Z']
        rule lower() -> char
            = ['a'..='z']
        rule digit() -> char
            = ['0'..='9']
        rule symbody() -> &'input str
            = $((upper() / lower() / digit())*)
        rule typename() -> Symbol
            = n1:upper() n2:symbody() { Symbol::type_name(format!("{n1}{n2}")) }
        rule message() -> Symbol
            = n1:lower() n2:symbody() { Symbol::message(format!("{n1}{n2}")) }
        rule vau() -> Symbol
            = "$" n1:lower() n2:symbody() { Symbol::vau(format!("{n1}{n2}")) }
        rule symbol() -> Symbol
            = typename() / message() / vau()
        rule mapkey() -> Symbol
            = message() / vau()

        pub rule object() -> SourceExpression
            = "{" name:typename() (mapkey() ) "}"

        pub rule program() -> Vec<SourceExpression>
            = l:(expression() ** whitespace()) { l }
    }
}

pub fn parse(program: String) -> Vec<SourceExpression> {
    simulabra_parser::program(program.as_str()).unwrap()
}

pub struct Parser {
    tokens: Vec<Token>,
}
