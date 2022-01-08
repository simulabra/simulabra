# TODO: make base library
import simulabra as sim

class SampleConfig(sim.ModelConfig):
    # TODO: model topologies
    topology = 'grid' # default
    width = 100
    height = 100
    # TODO: component system? (unity inspired)
    default_components = [sim.Position, sim.Shape] # default defaults?

    # TODO: easy slider/other way to adjust this from 0.0 to 1.0
    density = 0.5

class SampleWorld:
    # TODO: easy way to expose this in UI
    burned_trees = 0


def setup(config, world):
    for point in config.enumerate_points():
        if sim.random_chance(config.density):
            # TODO: spawning, with optional components
            world.spawn(Tree, point)
        if point.x == 0:
            world.spawn(Fire, point)

class Ember(sim.Agent):
    strength = 5

    @property
    def color(self):
        return sim.rgb(strength * 40 + 50, 0, 0)

    def step(self, world):
        self.strength -= 1
        if self.strength == 0:
            # TODO: dying
            self.die(world)

class Fire(sim.Agent):
    color = 'red'

    def step(self, world: SampleWorld):
        # TODO: neighbors (filter?)
        for tree in world.neighbors(self.position(), kind = Tree):
            tree.burn(world)
        # TODO: morphin
        world.become(self, Ember)

class Tree(sim.Agent):
    color = 'green'
    burned = False

    def burn(self, world):
        if not self.burned:
            self.color = 'black'
            self.burned = True
            world.spawn(Fire, self.position())
            world.burned_trees += 1

    def step(self, world):
        pass
