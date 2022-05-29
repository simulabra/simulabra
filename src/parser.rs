use std::collections::HashMap;

use crate::lexer::Token;

#[derive(Debug, Hash, PartialEq, Eq)]
pub enum SymbolKind {
    Type,
    Message,
    Vau,
}

#[derive(Debug, Hash, PartialEq, Eq)]
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
    String(String),
    Number(f32),
    Symbol(Symbol),
    Object(Symbol, KeyValueMap<SourceExpression>),
    List(Vec<SourceExpression>),
    Send(Box<SourceExpression>, Symbol, Option<Box<SourceExpression>>, Option<KeyValueMap<SourceExpression>>)
}

peg::parser!{
    grammar simulabra_parser() for str {
        rule ws()
            = (" " / "\n")+
        pub rule expression() -> SourceExpression
            = list() / object() / send() / symexpr() / string()

        pub rule list() -> SourceExpression
            = "[" l:(expression() ** ws()) "]" { SourceExpression::List(l) }

        rule upper() -> char
            = ['A'..='Z']
        rule lower() -> char
            = ['a'..='z']
        rule digit() -> char
            = ['0'..='9']
        rule symbody() -> &'input str
            = $((upper() / lower() / digit())* "!"?)
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
        rule symexpr() -> SourceExpression
            = s:symbol() { SourceExpression::Symbol(s) }
        rule string() -> SourceExpression
            = "'" val:$([^'\'']*) "'" { SourceExpression::String(val.to_string()) }

        rule map() -> KeyValueMap<SourceExpression>
            = keyvals:((key:mapkey() ws() val:expression() { (key, val) }) ** ws()) {
                let mut map = HashMap::new();
                for (key, val) in keyvals.into_iter() {
                    map.insert(key, val);
                }
                map
            }
        pub rule object() -> SourceExpression
            = "{" ws() name:typename() map:(ws() map:map() { map })? ws()? "}" {
                SourceExpression::Object(name, map.unwrap_or_default())
            }

        rule send() -> SourceExpression
            = "(" ws()? recv:expression() ws() meth:message()
                it:(ws() it:expression() { it })?
                args:(ws() args:map() { args })? ")" {
                SourceExpression::Send(Box::new(recv), meth, it.map(|se| Box::new(se)), args)
            }

        pub rule program() -> Vec<SourceExpression>
            = l:(expression() ** ws()) ws()? { l }
    }
}

pub fn parse(program: String) -> Vec<SourceExpression> {
    simulabra_parser::program(program.as_str()).unwrap()
}

pub struct Parser {
    tokens: Vec<Token>,
}
