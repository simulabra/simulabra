pub enum Token {
    Number(f32),
    Symbol(String),
}

peg::parser!{
    grammar parser() for str {
        rule number() -> f64
            = n:$(['0'..='9']+ ("." ['0'..='9']+)?) {? n.parse().or(Err("number")) }

        rule character() -> char
            = ['a'..='z' | 'A'..='Z']

        rule digit() -> char
            = ['0'..='9']

        rule alphanumeric() -> char
            = character() / digit()

        rule symbol() -> str
            = character
    }
}

pub struct Lexer {
    program: String,
}

impl Lexer {
    pub fn tokenize(&self) -> Vec<Token> {

    }
}
