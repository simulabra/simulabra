use nom::{
    IResult, combinator::recognize, sequence::pair, branch::alt, character::complete::{alpha1, alphanumeric1}, bytes::complete::tag, multi::many0
};

pub enum AST {
    Agent,
    Name(String),
}

impl AST {
}

pub fn identifier(input: &str) -> IResult<&str, AST> {
  recognize(
    pair(
      alt((alpha1, tag("_"))),
      many0(alt((alphanumeric1, tag("_"))))
    )
  )(input).map(|id| (id.0, AST::Name(id.1.to_string())))
}
