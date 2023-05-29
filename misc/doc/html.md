# HTML
Simulabra embeds its own hypertext markup language
The main issue is maintaining data-DOM correspondence
Inspiratio:
 - React: most popular, avoid mutating DOM directly, composable
 - HTMX: hypermedia focused, in HTML
 - Phoenix LiveView: server controlled, 
Let's work backwards from the DX I want for a toy example (todo-list)
```javascript
$.class.new({
  name: 'todo-item',
  components: [
    $.var.new({
      name: 'text',
      type: $.string,
    }),
    $.var.new({
      name: 'done',
      default: false,
    }),
    // react way
    $.method.new({
      name: 'render',
      do() {
        return $.div.of(
          $.checkbox.new({
            state: this.done(),
            change(value) { this.done(value); } 
          }),
          this.text()
        );
        <div>
          <$.checkbox state={this.done()} click={value => this.done(value)} />
          {this.text()}
        </div>
      }
    })
  ]
})

$.class.new({
  name: 'todo-item-html-view',
  components: [
    $.var.new({ name: 'item' }),
    $.method.new({
      name: 'render',
      do() {
        return $.div.of(
          $.checkbox.new({
            state: this.done(),
            change(value) { this.done(value); } 
          }),
          this.text()
        );
      }
    })
  ]
})
```
Come to think of it this approach to designing doesn't make a lot of sense, as what I ultimately want is a visual editor like Visual Basic or Figma that maps a concrete interface to code. So, what is best suited for that DX? I know there are projects in React-land that do something like this but I don't think they're that elegant. 


