use std::fmt::Display;

#[derive(Debug)]
pub enum SlabErr {
    Msg(String),
    IO(std::io::Error),
    List(Vec<Box<SlabErr>>),
    Chumsky(chumsky::error::Simple<char>),
}

impl SlabErr {
    pub fn msg<T: Into<String>>(s: T) -> Self {
        SlabErr::Msg(s.into())
    }
}

impl From<std::io::Error> for SlabErr {
    fn from(e: std::io::Error) -> Self {
        SlabErr::IO(e)
    }
}

impl From<chumsky::error::Simple<char>> for SlabErr {
    fn from(e: chumsky::error::Simple<char>) -> Self {
        SlabErr::Chumsky(e)
    }
}

impl Display for SlabErr {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SlabErr::Msg(s) => s.fmt(f),
            SlabErr::IO(io) => io.fmt(f),
            SlabErr::List(l) => {
                for e in l.iter() {
                    if let Err(e) = e.fmt(f) {
                        return Err(e);
                    }
                }
                Ok(())
            },
            SlabErr::Chumsky(ch) => ch.fmt(f),
        }
    }
}

pub type SlabResult<T> = Result<T, SlabErr>;
