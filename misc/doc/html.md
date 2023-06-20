## CRC

### ~component
base class for renderable HTML components like `<$circle r={2} />`
responsibilities:
 - render down to HTML elements
 - pushes updates to the DOM element
collaborators:
 - ~html_element
 - native DOM element

### ~html_element < ~component
HTML element such as div, a, span, form
responsibilities:
 - transform into correct textual HTML for represented element
 ? track rendered element in DOM


## processes

### component rendering
recursive calls to render form a tree of html elements
(child components render wrapped with container)
swap inner html of container element
