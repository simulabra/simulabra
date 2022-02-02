use std::{ops::Range, fs};
use chumsky::{prelude::*};


pub type Span = Range<usize>;

#[derive(Debug, Clone)]
enum Token {
  Bool(bool),
  Number(String),
  Str(String),
  Op(String),
  Property(String),
  LParen,
  RParen,
  LBracket,
  RBracket,
  Colon,
  Dot,
  Comma,
  Class,
  Var,
  Has,
  On,
  Action,
  Parameter,
  Function,
  If,
  Else,
  For,
  Ident(String),
}

fn lexer() -> impl Parser<char, Vec<(Token, Span)>, Error = Simple<char>> {
  let num = text::int(10)
    .chain::<char, _, _>(just('.').chain(text::digits(10)).or_not().flatten())
    .collect::<String>()
    .map(Token::Number);

  let stre = just('"')
    .ignore_then(filter(|c| *c != '"').repeated())
    .then_ignore(just('"'))
    .collect::<String>()
    .map(Token::Str);

  let op = one_of("+-*/!=<>")
    .repeated()
    .at_least(1)
    .collect::<String>()
    .map(Token::Op);

  macro_rules! char_rec {
    ( $char:literal, $tok:ident ) => {
      just($char).map(|_| { Token::$tok })
    }
  }
  let lparen = char_rec!('(', LParen);
  let rparen = char_rec!(')', RParen);
  let lbracket = char_rec!('{', LBracket);
  let rbracket = char_rec!('}', RBracket);
  let colon = char_rec!(':', Colon);
  let dot = char_rec!('.', Dot);
  let comma = char_rec!(',', Comma);

  let ident = text::ident::<char, Simple<char>>().map(|ident: String| match ident.as_str() {
    "class" => Token::Class,
    "var" => Token::Var,
    "has" => Token::Has,
    "on" => Token::On,
    "action" => Token::Action,
    "parameter" => Token::Parameter,
    "function" => Token::Function,
    "for" => Token::For,
    "if" => Token::If,
    "else" => Token::Else,
    "true" => Token::Bool(true),
    "false" => Token::Bool(false),
    _ => Token::Ident(ident),
  });

  let token = num
    .or(stre)
    .or(op)
    .or(lparen)
    .or(rparen)
    .or(lbracket)
    .or(rbracket)
    .or(colon)
    .or(dot)
    .or(comma)
    .or(ident);

  let comment = just("//").then(take_until(just('\n'))).padded();

  token
    .padded_by(comment.repeated())
    .map_with_span(|tok, span| (tok, span))
    .padded()
    .repeated()
}

pub fn parse() {
  let src = fs::read_to_string("./src/lang/ex.slab").expect("failed to read");
  println!("{}", src);
  let (tokens, mut errs) = lexer().parse_recovery(src.as_str());

  println!("{:?}", tokens);
}
