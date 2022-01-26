import simulabra as sim
import numpy as np

# TODO: model topologies
topology = 'grid' # default
width = 100
height = 100
# TODO: component system? (unity inspired)
default_components = [sim.Position, sim.Shape] # default defaults?

# TODO: easy slider/other way to adjust this from 0.0 to 1.0
density = sim.Slider(0.0, 0.5, 1.0)

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
    # position = Position(0, 0)

    # @sim.update
    def step(self, world: SampleWorld):
        # TODO: neighbors (filter?)
        for tree in world.neighbors(self.position, kind = Tree):
            tree.burn(world)
        # TODO: morphin
        world.become(self, Ember)

class Tree(sim.Agent):
    color = 'green'
    burned = False

    # @sim.filter(not burned)
    def burn(self):
        self.color = 'black'
        self.burned = True
        self.world.spawn(Fire, self.position)
        self.world.burned_trees += 1
