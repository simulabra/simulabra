## CRC

### ~component
base class for renderable HTML components like `<$circle r={2} />`
responsibilities:
 - transform into node and mount to DOM
 - observe variables for updates and propogate to node
 - handle DOM events from node
collaborators:
 - ~node
methods:
 - render(): ~node

### ~node
base class for DOM node wrappers
responsibilities:
 - interpret attributes and children into initprops, event handlers, bindings, slots, etc
 - transform into native DOM node
 - handle updates and calculate/apply changes
collaborators:
 - ~component
 - DOM
methods:
 - static interpret(tag, attributes, children): ~mytype
 - domify(): native DOM node

### ~html_element < ~node
HTML element with tag, attributes, and children
responsibilities:
 - interpret tag, attributes, and children into represented element


## processes

### component rendering
recursive calls to render form a tree of html elements
(child components render wrapped with container)
swap inner html of container element


## SSR
seems a bit tricky

### potential dependencies
https://github.com/jsdom/jsdom
use bun?
