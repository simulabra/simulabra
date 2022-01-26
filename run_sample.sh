#!/usr/bin/env bash
set -ex

PIPENV_VENV_IN_PROJECT=1
pipenv run maturin develop -m simulabra-pylib/Cargo.toml
cargo build
pipenv run ./target/debug/simulabra-core models/fire.py
