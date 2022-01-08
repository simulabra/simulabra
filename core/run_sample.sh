#!/usr/bin/env bash

cargo build
cd models/sample
../../target/debug/simulabra-core
