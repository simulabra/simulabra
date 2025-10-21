#!/bin/zsh

watchexec -w . -e js -r -- sh -c 'clear && bun run "$@"' -- $1
