<>
  // React way
  <Class name="todo_list">
    <$Class name="component" />
    <Var name="todos" def={[]} />
    <Method
      name="add"
      fn={todo => this.todos().push(todo)} />
  </Class>

  // my way
  <$class name="point">
    <$var name="x" def={0} />
    <$var name="y" def={0} />
    <$method name="dist" fn={Math.sqrt(this.x() ** 2 + this.y() ** 2)} />
    <$template><div>({this.x()}, {this.y()})</div></$template>
  </$class>
</>
