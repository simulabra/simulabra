(component hunger
  (has position)
  (var energy
    (doc "how much energy left, 0 is starvation")
    (type number)
    (default 100))
  (on move (seq
    (send (dec move-energy-use) energy)
    (if (< energy 0) (do starve))))
  (on step (send (dec idle-energy-use) energy)))

(agent sheep
  (has hunger position)
  )

(form has
   (arg name (type ident) )
  )
(form component :name
  )
