<ProductRequirementDocument>
Simulabra Agenda is the personal productivity system that I have been wanting to build for a while, after finding the alternatives wanting. 
It is accessed either as a typical web application or via sms, which interprets messages into the same commands used in the application, either directly via forms like `/log remember this` or indirectly from the context. 
<Clients>
<WebClient>
- web application (pattern off demos/dummy/client.js and demos/loom.js)
- accessed over tailscale, don't worry about auth for now
- chat window plus custom views for different item types
</WebClient>
<SMSClient>
- text an agent with commands like `/log remember this`
- chat with the geist of the agenda who can use tools
- send reminders and follow-ups
</SMSClient>
<CLIClient>
- similar to sms client but invoked from command line
- `bun run agenda-cli log 'remember this'`
</CLIClient>
</Clients>
<Services>
Services coordinate via the live system.
<DatabaseService>
- fetches data from redis
- processes the change feed
</DatabaseService>
<ReminderService>
- checks scheduled reminders and executes when conditions are met
</ReminderService>
</Services>

<Commands>
<Log>
<SMSFormat>`log something to say`</SMSFormat>
<Description>saves the argument to a searchable journal, with a timestamp</Description>
</Log>
<RemindMe>
<SMSFormat>`remind me to check for 4b history llm upload in a week`</SMSFormat>
<Description>instruct the system to remind you of something at a later date</Description>
</RemindMe>
</Commands>
</ProductRequirementDocument>

