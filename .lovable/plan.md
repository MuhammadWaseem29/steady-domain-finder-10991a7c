## Confirmed issue

`taobao.com` returns about **150,512** hosts and `digimobil.es` about **148,396**. The current manual action fetches and writes everything inside one HTTP request, with up to **45 seconds fetching + 90 seconds writing**. The hosting request deadline terminates it first, producing “Internal server error.” Removing the local timeout alone cannot remove the platform’s request deadline.

## Implementation

1. **Create persistent scan jobs**
   - Add a service-only `scan_jobs` table that tracks domain, state, total hosts, processed hosts, new hosts, cursor, timestamps, and errors.
   - Store the fetched Chaos result as resumable job data so it is fetched once and processed across multiple short worker calls.
   - Ensure only one active manual job exists per domain.

2. **Make “Scan now” return immediately**
   - Change `runScanNow` to create or resume a job rather than keeping the browser request open.
   - Return a job ID and current progress in a few seconds.
   - Never expose a generic server error; return typed failure details.

3. **Process every host in bounded chunks**
   - Add a database ingestion function using `INSERT … ON CONFLICT DO NOTHING` that returns only the number inserted, rather than echoing thousands of rows.
   - Process chunks repeatedly until the cursor reaches the full Chaos result—no host-count limit.
   - Each worker invocation stays below the request deadline; unfinished work remains queued and resumes automatically.
   - Finalize the scan history and domain counters only when the entire job completes, preserving accurate “new last scan” data.

4. **Connect jobs to the existing scheduled worker**
   - Each cron tick processes pending manual jobs before/alongside the rolling domain sweep.
   - Large scans continue even if the user closes the page.
   - Recover stale `processing` jobs automatically after an interrupted invocation.

5. **Show live progress on the domain page**
   - Replace the endlessly spinning button with `Queued`, `Fetching`, `Saving 84,000 / 150,512`, and `Complete` states.
   - Poll progress, update the progress bar, and refresh subdomains/history when complete.
   - Prevent duplicate clicks while that domain already has an active job.

6. **Verify with the two large domains**
   - Run `taobao.com` and `digimobil.es` scans through the UI.
   - Confirm the button returns promptly, progress continues across multiple worker runs, every returned host is processed, and final scan rows are successful without an internal server error.