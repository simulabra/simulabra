# agenda prd

Simulabra Agenda is the personal productivity system that I have been wanting to build for a while, after finding the alternatives wanting. 
It is accessed either as a typical web application or via sms, which interprets messages into the same commands used in the application, either directly via forms like `/log remember this` or indirectly from the context. 
<Clients>
<WebClient>
web application (pattern off demos/dummy/client.js and demos/loom.js)
accessed over tailscale, don't worry about auth for now
</WebClient>
<SMSClient>
</SMSClient>
<CLIClient>
</CLIClient>
</Client>
The messages and associated state are stored on a backend VPS via the live system and Redis. 
Assume authentication for the backend is handled via tailscale isolation, and the messages are checked against my phone number. 
Background loop running every minute that checks for queued messages/actions.
Develop live system when it is lacking something, try to use multiple different clients when appropriate (like a different client for the reminder loop and the text handler).


Text commands:
- `/log` - saves to a searchable journal with timestamp
- `/remember` - adds a reminder for the agent context
- `/remindme` - instruct agent to remind the user with a message at a later date


