class Fire(sim.Model):
    position: sim.Position
    drawable: sim.Drawable

    def __init__(self):
        self.randomize_position()

    def step(self):
        self.position.x += 1
