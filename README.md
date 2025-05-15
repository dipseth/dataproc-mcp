## Troubleshooting: Excessive Logs and JSON Parse Errors

If you see errors like:

```
Error from MCP server: SyntaxError: Unexpected token 'D', "[DEBUG] ..." is not valid JSON
```

**Cause:**  
The MCP server or SDK is writing debug/info logs to stdout, which is reserved for JSON protocol messages. This causes the SDK to attempt to parse log lines as JSON, resulting in parse errors and noisy output.

**How to Fix:**

1. **Redirect logs to stderr or a file:**  
   - Update your logging configuration so that all debug/info logs are sent to `stderr` or a log file, not `stdout`.
   - In Node.js, use `console.error()` for logs, or configure your logger (e.g., `winston`, `pino`) to use `stderr` for non-protocol output.

2. **Set log level to error/warn for tests:**  
   - Temporarily set the log level to "error" or "warn" in your test/dev environment to reduce noise.
   - Example (if using an environment variable):  
     ```
     export LOG_LEVEL=error
     npm run test:integration
     ```

3. **Check MCP server entrypoint:**  
   - Ensure that only protocol JSON messages are written to `stdout` if using stdio for MCP communication.
   - All other logs should go to `stderr`.

4. **Optional: Patch SDK for local dev:**  
   - If you cannot change the server, patch the SDK or test runner to ignore non-JSON lines or filter out debug logs.

**Summary:**  
- Only protocol messages should go to stdout.
- All logs should go to stderr or a file.
- Lower log level for tests to reduce output.

This will resolve the JSON parse errors and make your test output much cleaner.
