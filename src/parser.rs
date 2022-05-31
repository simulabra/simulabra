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

pub type KeyValueMap<T> = HashMap<String, T>;

#[derive(Debug, Hash, PartialEq, Eq)]
pub struct Message(String, bool);

impl Message {
    fn call(name: String) -> Self {
        Self(name, false)
    }

    fn vau(name: String) -> Self {
        Self(name, true)
    }
}

#[derive(Debug)]
pub enum SourceExpression {
    String(String),
    Number(f32),
    Type(String),
    Message(Message),
    Object(Box<SourceExpression>, KeyValueMap<SourceExpression>),
    List(Vec<SourceExpression>),
    Send(Box<SourceExpression>, Box<SourceExpression>, Option<Box<SourceExpression>>, Option<KeyValueMap<SourceExpression>>)
}

impl SourceExpression {
    fn mapkey(&self) -> Option<String> {
        match self {
            SourceExpression::Message(Message(m, vau)) => Some(format!("{}{}", if *vau { "$" } else { "" }, m)),
            _ => None,
        }
    }

    fn call(name: String) -> Self {
        Self::Message(Message::call(name))
    }

    fn vau(name: String) -> Self {
        Self::Message(Message::vau(name))
    }
}

peg::parser!{
    grammar simulabra_parser() for str {
        rule ws()
            = (" " / "\n")+
        pub rule expression() -> SourceExpression
            = list() / object() / send() / typename() / call() / vau() / string() / numexp()

        pub rule list() -> SourceExpression
            = "[" ws()? l:(expression() ** ws()) ws()? "]" { SourceExpression::List(l) }

        rule upper() -> char
            = ['A'..='Z']
        rule lower() -> char
            = ['a'..='z']
        rule digit() -> char
            = ['0'..='9']
        rule num() -> f32
            = dec:$(digit()+ ("." digit()*)?) {? dec.parse().or(Err("number")) }
        rule numexp() -> SourceExpression
            = n:num() { SourceExpression::Number(n) }
        rule symbody() -> &'input str
            = $((upper() / lower() / digit())* "!"?)
        rule typename() -> SourceExpression
            = n1:upper() n2:symbody() { SourceExpression::Type(format!("{n1}{n2}")) }
        rule opchar() -> char
            = ['*' | '+']
        rule op() -> SourceExpression
            = op:opchar() { SourceExpression::call(op.to_string()) }
        rule call() -> SourceExpression
            = n1:lower() n2:symbody() { SourceExpression::call(format!("{n1}{n2}")) }
        rule vau() -> SourceExpression
            = "$" n1:lower() n2:symbody() { SourceExpression::vau(format!("{n1}{n2}")) }
        rule message() -> SourceExpression
            = op() / call() / vau()
        rule string() -> SourceExpression
            = "'" val:$([^'\'']*) "'" { SourceExpression::String(val.to_string()) }

        rule map() -> KeyValueMap<SourceExpression>
            = keyvals:((key:message() ws() val:expression() { (key, val) }) ** ws()) {
                let mut map = HashMap::new();
                for (key, val) in keyvals.into_iter() {
                    map.insert(key.mapkey().unwrap(), val);
                }
                map
            }
        pub rule object() -> SourceExpression
            = "{" ws() name:typename() map:(ws() map:map() { map })? ws()? "}" {
                SourceExpression::Object(Box::new(name), map.unwrap_or_default())
            }

        rule send() -> SourceExpression
            = "(" ws()? recv:expression() ws() meth:message()
                it:(ws() it:expression() { it })?
                args:(ws() args:map() { args })? ")" {
                SourceExpression::Send(Box::new(recv), Box::new(meth), it.map(|se| Box::new(se)), args)
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
