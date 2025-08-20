# Issue and Bug Log

## Templates
### Issue
```
Issue: [briefly describe the issue]

Details:
[a bulleted list of details]

Component(s): [e.g. frontend, backend, design system, cli, etc]

Steps to Reproduce:
[numbered list of steps to reproduct OR a brief description if reproduction is simple]

Desired Behavior:
[What the application should do instead]
```

### Bug
```
Bug: [briefly describe the bug]

Steps to Reproduce:
[numbered list of steps to reproduct OR a brief description if reproduction is simple]

Component(s): [e.g. frontend, backend, design system, cli, etc]

Logs/Stack Traces/Error Messages:
[paste here. separate in individual code fences]
```

## Inbox

### Design/Frontent Issues
last updated 8/17/25
1. The "total events" counter (in the top panel and the live event feed event count) stops at 1000. It should continue counting past 1000.
2. The event times are not reflected correctly in the ui:
- on each event card the relative time is way off (probably a timezone issue, possibly a data issue)
- clicking into an event card and opening the modal shows incorrect event times (probably a timezone issue, possibly a data issue)
3. The connection status component's relative time keeps resetting, i think every time an event comes in. honestly i dont think this component needs a timer. its distracting, so remove it.
4. the entire rounded panel that says "chronicle observabilty" needs to be deleted, actually:
- the connection status indidcator should go into the header
- the title and subtitle should be the header's title and subtitle

- the connection status indidcator should go into the header\        │
│   - the title and subtitle should be the header's title and subtitle\  │
│   - the events rows in the live event feed should be substanally       │
│   thinner and tighter\                                                 │
│   - there needs to be a horizontal, live "graph" of events between     │
│   the main header and the live event feed. it should be a bar chart    │
│   representing the event count in 10s intervals over the last 10m.     │
│   each bar should be grouped by event type.\                           │
│   - the UI should prominent display a count of active sessions that    │
│   are awaiting input (last event of the session was a notification) 
## Ready to Work
