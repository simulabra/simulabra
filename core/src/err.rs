use std::fmt::Display;

use pyo3::{prelude::*, PyDowncastError};

#[derive(Debug)]
pub enum SlabErr {
    Msg(String),
    Py(PyErr),
    IO(std::io::Error),
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

impl From<PyErr> for SlabErr {
    fn from(e: PyErr) -> Self {
        SlabErr::Py(e)
    }
}

impl Display for SlabErr {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SlabErr::Msg(s) => s.fmt(f),
            SlabErr::Py(p) => p.fmt(f),
            SlabErr::IO(io) => io.fmt(f),
        }
    }
}

pub type SlabResult<T> = Result<T, SlabErr>;
