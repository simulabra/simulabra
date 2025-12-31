### SIMULABRA

SIMULABRA is a software project consisting of a metaobject system for Javascript and a set of tools. Classes are defined in terms of slots, which are themselves instances of classes. Inheritance is just in terms of slots. Before and after slots wrap methods. Extensibility is baked in. Signal slots and HTML templating power web applications like the loom demo. And more is yet to come.

For a fuller tour of its features, read through `demos/loom.js` or `tests/core.js`.


```
$.Class.new({
  name: 'Point',
  doc: 'a 2d point in Euclidean space',
  slots: [
    $.Var.new({
      name: 'x',
      default: 0,
    }),
    $.Var.new({
      name: 'y',
      default: 0,
    }),
    $.Method.new({
      name: 'dist',
      doc: 'the distance to another point',
      do(other) {
        return Math.sqrt((this.x() - other.x())**2 + (this.y() - other.y())**2);
      },
    }),
  ],
});

$.Point.new({ x: 3, y: 4 }).dist($.Point.new()) // 5
```

To run locally, install Bun first, then run:
``` sh
bun install
./serve.sh
```
Then navigate to e.g. http://localhost:8080/loom

## SIMULABRA HYPERLOOM

HYPERLOOM is a base model writing interface. It generates choices for the next N tokens as completions, not chat. The user selects, reseeks, or modifies the text.

Try at 'https://simulabra.com/loom', by pointing the base url to a local llama.cpp server (like http://localhost:3731). To launch the llama.cpp server, for example:

    ./llama.cpp/build/bin/llama-server --port 3731 -t 8 -m <model> -ngl 99 -np 8

There is also a provider for 405b base on Hyperbolic which requires an API key, and a generic OpenAI-compatible API provider that has been tested with the OpenAI API using davinci-002 as the model and https://api.openai.com as the base URL.

New: support for multimodal models with llama.cpp, with an image upload feature.
