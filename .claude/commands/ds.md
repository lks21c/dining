# Dev Server Management

Manage Next.js dev server as a Claude Code background process.

**Usage**: `/ds <start|stop|restart>`

**Argument**: $ARGUMENTS

## Instructions

### `start`
1. Check if a dev server is already running:
   ```bash
   lsof -ti:3000
   ```
2. If already running, report "Dev server already running on port 3000 (PID: <pid>)" and exit.
3. If not running, start the dev server in the background using Bash tool with `run_in_background: true`:
   ```bash
   npm run dev
   ```
4. Wait 5 seconds, then read the background task output to confirm the server started successfully.
5. Report the URL (localhost port) and background task ID.

### `stop`
1. Find the process on port 3000:
   ```bash
   lsof -ti:3000
   ```
2. If no process found, report "No dev server running" and exit.
3. Kill the process:
   ```bash
   kill $(lsof -ti:3000)
   ```
4. Also remove the Next.js dev lock file if it exists:
   ```bash
   rm -f .next/dev/lock
   ```
5. Confirm the server has stopped.

### `restart`
1. Execute the `stop` steps above.
2. Wait 2 seconds.
3. Execute the `start` steps above.

## Output Format

```
Dev Server: <started|stopped|restarted>
URL: http://localhost:<port>
PID: <process id>
Task ID: <background task id> (for start/restart)
```

## Notes
- The dev server runs as a Claude Code background process so it persists during the session.
- Use `stop` to clean up before ending your session or if port conflicts occur.
- The lock file `.next/dev/lock` is cleaned up on stop to prevent stale lock issues.
