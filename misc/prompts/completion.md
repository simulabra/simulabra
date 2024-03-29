Simulabra is an object-oriented Lisp that translates to Javascript.

Example code:
```
~class:completor-fetch-next-command{
  :slots [
    ~var:target{ :type ~completor }
    ~var:count{ :type ~number }
    ~var:temperature{ :type ~number }
    ~var:server{ :default '100.64.172.3' }
    ~method:run{
      :do (
        %completions([])
        %server-url(`http://${.server}:3731`)
        .target.completion-candidates.reset
        %logit-bias([])
        %count(.count??(.target.count)) ; optional chaining???
        $for(%i(0) %i.lt(%count) %i(%i.+(1))
          %completion(~local-llama-completion-command{
            :server-url %server-url
            :prompt .target.prompt
            :logit-bias %logit-bias
            :n-predict %n-predict
            :temperature %temperature
          }.run@await)
          %completions.push(%completion)
          $if(%completion.noteq('')
            .target.completion-candidates.add(%completion)
            %tokens(~local-llama-tokenize-command{
              :server-url %server-url
              :prompt %completion
            }.run@await)
            %tokens@for-each(%tok
              %logit(%logit-bias.find(&(%it@el(0)@eq(%tok))))
            )  
          )
        )
      )
    }
  ]
}
```

Write a todo-list application using Simulabra.

