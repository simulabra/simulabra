In Simulabra, you usually want tests for the things you are building to keep them stable. A basic test library is included.

A basic test case:
    $.Case.new({
      name: 'ClassDef',
      doc: 'Tests basic class definition and retrieving the class from an instance.',
      do() {
        const b = $.BasicTestClass.new();
        this.assert(b, 'Instance should be created');
        this.assertEq(b.class(), $.BasicTestClass, 'Instance class should match definition');
      }
    });


