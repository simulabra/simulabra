# SIMULABRA: INFINITE SOFTWARE
Simulabra is an object-oriented programming system (language/editor/platform) for the Web, built from the ground up for human-AI symbiosis. Use it to build whatever you can imagine, whether that's websites, simulations, games, or AI agents.

A taste:
``` simulabra
~class{
  :name=:point
  :doc="a 2d point in Cartesian space"
  :components=(
    ~var{
      :name=:x
      :type=~number
      :default=0
    }
    ~var{
      :name=:y
      :type=~number
      :default=0
    }
    ~method{
      :name=:center-dist
      :ret=~number
      :do=[
        .x.**(2).+(.y.**(2)).sqrt
      ]
    }
  )
}
```

Simulabra draws from the work of many, some nearly forgotten, in traditions that go back to the classical age of computing.
## Language
 - inspired by Smalltalk and Lisp
 - targets Javascript for speed, ecosystem, ubiquity, and [suitability of prototypes as a substrate for class sytems](http://merlintec.com/vmworkshop99/sub.pdf)
 - multiple inheritance and method combination like CLOS/[Flavors](https://www.softwarepreservation.org/projects/LISP/MIT/nnnfla1-20040122.pdf)
 - interfaceless type system based on [LOOM](https://www.researchgate.net/profile/Kim-Bruce-2/publication/221496196_Subtyping_Is_Not_a_Good_Match_for_Object-Oriented_Languages/links/09e415122545c6d7a4000000/Subtyping-Is-Not-a-Good-Match-for-Object-Oriented-Languages.pdf)
 - concrete, uniform syntax with no constructors, no precedence rules, and no keywords
 - metaprogrammable when it has to be
## Editor
 - Web based and mobile friendly, like Replit
 - inspect and explore live systems with ease
 - integrated AI assistant can help with debugging, designing, coding, documenting, testing, and more
 - malleable and programmable in the same language you're using it for
## Platform
 - restore sanity to deployments, CI/CD, security, observability, etc
 - distributed object system forming [one huge computer](https://www.wired.com/1998/08/jini/), with capabilities, leasing, and discovery
 - end the front-end/back-end schism - it's all one program
 - amenable storage abstraction with multiple backends and adapters for third-party databases
 - fostered ecosystem of libraries, tools, and services
 

## Current status
After bikeshedding the language for over a year, it's time to start building the editor and platform parts, although the language is far from done. Anything and everything is up to change during the alpha stage. Perhaps more important is the AI assistant that will help bootstrap the rest of the project.


## Running
Right now there's just a console test runner that's probably broken.
``` sh
npm install
npm run test
```
