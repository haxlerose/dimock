# Deploy to SFTP Server

Upload files changed in the last commit (or all files) to the SFTP server.

## Steps

1. Read `.env` file to get `SFTP_SERVER` and `SFTP_PASSWORD`. If either is missing, stop and tell the user.

   `SFTP_SERVER` format is `user@host` — parse username and host separately.

2. Determine what to upload:
   - Default: files changed in the last commit — `git diff-tree --no-commit-id -r --name-only HEAD`
   - If user said "all", "full", or "sync all": every tracked file — `git ls-files`
   - Exclude files that don't exist locally (deleted in last commit)
   - Always exclude files in the `backup/` folder

3. Show the file list and ask for confirmation before uploading.

4. Upload using `expect` to drive the built-in `sftp`. Build a single `expect` script that connects once and issues a `put` command for each file:

   ```bash
   expect << 'EOF'
   set timeout 30
   spawn sftp -o StrictHostKeyChecking=no <user>@<host>
   expect "password:"
   send "<SFTP_PASSWORD>\r"
   expect "sftp>"
   send "put <file1> <file1>\r"
   expect "sftp>"
   send "put <file2> <file2>\r"
   expect "sftp>"
   send "bye\r"
   expect eof
   EOF
   ```

   Remote path mirrors local relative path (e.g. `index.html` → `/index.html`).

   If `expect` is not available (`which expect` fails), tell the user to install `lftp` via `brew install lftp` and use that instead.

5. Report success or any errors. If a file fails, list it and continue with the rest.

## Notes

- `.env` is gitignored — credentials never committed
- `lftp`, `sshpass`, and curl SFTP are NOT available on this machine — use `expect`
- For full sync: `/deploy all`
- Remote root defaults to `/` unless specified (e.g. `/deploy to /public_html`)
