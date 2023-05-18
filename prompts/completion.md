Simulabra is a new object-oriented programming language for the web.

Here are some valid Simulabra modules.
```simulabra
!import=(:base :lang :test)

~class{
  :name=:point
  :components=(
    ~deffed
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
      :name=:dist
      :args=(~self)
      :ret=~number
      :do=[_ ^.x.-(_.x).pow(2).+(.y.-(_.y).pow(2)).sqrt]
    }
    ~method{
      :name=:translate
      :do=[|%x %y|
        .x(.x.+(%x))
        .y(.y.+(%y))
      ]
    }
  )
}

~case{
  :name=:basic-points ; skewer-cased
  :do=[
    %p=~point{:x=3}
    %q=~point{:y=4}
    .assert-eq(%p.dist(%q) 5)
    %p.translate(1 3)
    .assert-eq(%p.dist(~point{}) 5)
  ]
}

~class{
  :name=:math
  :components=(
    ~static{
      :name=:pi
      :do=[^3.14159]
    }
  )
}

~class{
  :name=:shape
  :components=(
    ~point
    ~virtual{
      :name=:area
      :ret=:number
    }
  )
}

~class{
  :name=:circle
  :components=(
    ~shape
    ~var{
      :name=:r
      :type=:number
      :default=1
    }
    ~method{
      :name=:area
      :do=[^~math.pi.*(.r.pow(2))]
    }
  )
}

~case{
  :name=:basic-circles
  :do=[
    %p=~circle{:x=3}
    %q=~circle{:y=4 :r=2}
    .assert-eq(%p.dist(%q) 5)
    .assert-eq(%p.area ~math.pi)
    .assert-eq(%q.area 4.*(~math.pi))
  ]
}

~case{
  :name=:basic-references
  :do=[
    %p=~point{:name=:test :x=7}
    .assert-eq(~point.new.x 0)
    .assert-eq(~point#test.x 7)
  ]
}

~case{
  :name=:basic-closures
  :do=[
    %fn=[_ ^_.*(2)]
    %q=%fn(3)
    .assert-eq(%q 6)
    %fnp=[^.x.*(2)]
    %p=~point{:x=2}
    .assert-eq(%fnp.apply(%p) 4)
  ]
}

~class{
  :name=:waiter
  :components=(
    ~method{
      :name=:wait
      :async=@true
      :do=[|%ms|
        ~promise{
          :do=[
            $.js(:setTimeout)(1000 [
              .resolve
            ])
          ]
        }
      ]
    }
  )
}

~async-case{
  :name=:basic-async
  :do=&[
    &~waiter.new.wait(1000);
  ]
}

~class{
  :name=:static-counter
  :components=(
    ~static-var{
      :name=:count
      :default=0
    }
    ~static{
      :name=:inc
      :do=[.count(.count.+(1))]
    }
  )
}

~case{
  :name=:basic-static
  :do=[
    .assert-eq(~static-counter.count 0)
    ~static-counter.inc
    ~static-counter.inc
    .assert-eq(~static-counter.count 2)
  ]
}

~case{
  :name=:basic-conditionals
  :do=[
    ;.assert-eq(@true.$if{:then=1 :else=0} 1)
  ]
}

```
```simulabra
!import=(:base :lang :test :html)
!js-import=(:http :axios)

~class{
  :name=:js-wrap
  :components=(
    ~var{
      :name=:inner
      :foreign=@true
    }
  )
}

~class{
  :name=:url
  :components=(
    ~js-wrap
    ~static{
      :name=:from-string
      :do=[|%url-string|
        ^.new{
          :inner=$.js(`"new URL(\"${%url-string}\")")
        }
      ]
    }
  )
}

~class{
  :name=:request-handler
  :components=(
    ~var{:name=:server}
    ~var{:name=:path}
    ~var{:name=:do}
    ~after{
      :name=:init
      :do=[.server.add-handler(.me)]
    }
    ~method{
      :name=:handle
      :do=[|%req %res| .do(%req %res)]
    }
  )
}

~class{
  :name=:http-request
  :components=(
    ~var{:name=:verb}
    ~var{:name=:url}
    ~method{
      :name=:fetch
      :do=[
        ^$.js("axios").request{
          :url=.url.href
          :method=.verb
        }
      ]
    }
  )
}

~class{
  :name=:http-server
  :components=(
    ~js-wrap
    ~var{
      :name=:handlers
      :default=()
    }
    ~method{
      :name=:add-handler
      :do=[|%handler| .handlers.push(%handler)]
    }
    ~method{
      :name=:path-handler
      :do=[|%path|
        ^.handlers.find([_ ^_.path.eq(%path)])
      ]
    }
    ~method{
      :name=:create-server
      :do=[|%fn|
        ^.inner($.js(:http).createServer(%fn))
      ]
    }
    ~method{
      :name=:start
      :do=[|%port|
        .create-server([|%req %res|
          %path-handler=.path-handler(%req.url)
          %path-handler.if-null(
            [%res.end("404 Not Found")]
            [%path-handler.handle(%req %res)]
          )
        ]).listen(%port)
      ]
    }
  )
}

~async-case{
  :name=:basic-http-path-handlers
  :do=[
    %server=~http-server.new
    %handler=~request-handler{
      :name=:test-handler
      :server=%server
      :path="/"
      :do=[|%req %res|
        %res.writeHead(200 {:Content-Type="text/html"})
        %res.end("<!DOCTYPE html><html><body><h1>Hello, World!</h1></body></html>")
      ]
    }
    .assert-eq(%handler.name %server.path-handler("/").name)
    %server.start(8080)
    .log("server started")
  ]
}
```

Using these, complete the code for the agent module below.
```
!import=(:http :html :test :base)

~class{
  :name=:agent
  :responsibilities=(
    "manages websocket connections with clients"
    "responds to http requests with the bootstrap html document"
  )
  :components=()
}

~class{
  :name=:message-log
  :responsibilities=(
    "hold messages from subsystems sorted by date"
    "filter views by origin, time, regex, etc"
  )
  :components=()
}
```
