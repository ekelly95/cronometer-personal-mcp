# Running this on macOS

The macOS path is **built**, not merely designed. What follows is how to use it, and —
just as important — exactly which parts of it have never been run on a Mac.

Read the last section before you trust any of this. It is short and specific.

---

## Setup

```bash
git clone <this repository>
cd cronometer-personal-mcp
sh scripts/setup-macos.sh
```

You need `node`, `npm`, `uv` and `security` on `PATH`. The last one ships with macOS.

The script does what the Windows one does, in the same order: installs dependencies,
creates the Python environment from the locked requirements, builds, runs the
TypeScript and Python test suites, asks for your diary timezone, makes you type the
literal word `ENABLE` to acknowledge that this uses an unsupported interface, takes
your credentials, then offers to register the server with Codex, Claude Code and
Claude Desktop.

It stops at the first failure. A setup script that carries on past a failed test
leaves you with something that looks installed.

---

## What is different from Windows, and why

Only two things differ. Everything else — the server, the parsers, the coverage
analysis, the Python bridge — is the same code.

### The password lives in the login Keychain

Windows encrypts it with DPAPI and stores the ciphertext in `live-config.json`. On
macOS that file holds **no secret at all**; the password is in the Keychain under the
service name `cronometer-personal-mcp`.

```bash
# What setup runs. No `-w <value>`: omitting the value makes `security` prompt for it.
security add-generic-password -a "$USER" -s cronometer-personal-mcp -U -w

# What the launcher runs.
security find-generic-password -s cronometer-personal-mcp -a "$USER" -w
```

Passing the password as an argument instead would put it in the process table, where
any other process can read it for the lifetime of the call. Hence the prompt.

Expect the Keychain to ask for permission the first time the launcher runs. That is
the system working. "Always Allow" scopes the grant to that one binary.

`live-config.json` records `"credential_source": "keychain"`, and each launcher refuses
a configuration written for the other platform rather than failing later with a
misleading message.

### The data directory is protected by its mode, not an ACL

There is a pleasing inversion here. The audit found that `os.chmod(0o600)` on the
session cache is a **no-op on Windows**, where the real protection is an ACL the setup
script applies. On macOS that line becomes load-bearing and the ACL machinery is what
falls away. The code that is decorative on one platform is the actual defence on the
other.

`run-mcp.sh` checks the mode on every start and refuses to run if it has loosened,
exactly as `run-mcp.ps1` re-checks the ACL. That check matters more than it looks:
`~/Library/Application Support` is not private by default in the way `%LOCALAPPDATA%`
is, and this directory holds both the session cookie and your downloaded diary.

| | Windows | macOS |
|---|---|---|
| Password | DPAPI ciphertext in `live-config.json` | login Keychain |
| Data directory | `%LOCALAPPDATA%\CronometerPersonalMcp` | `~/Library/Application Support/CronometerPersonalMcp` |
| Protection | ACL, inheritance broken | mode `700`, checked on every start |
| Launcher | `scripts/run-mcp.ps1` | `scripts/run-mcp.sh` |
| Claude Desktop config | `%APPDATA%\Claude\` | `~/Library/Application Support/Claude/` |

---

## What is shared rather than written twice

The Claude Desktop registration is the fiddliest code in the project. Desktop has no
CLI for it, so its configuration file has to be rewritten in place — and that file
holds Desktop's own preferences, nested several levels deep. It backs the file up,
refuses to overwrite an existing entry of the same name, and requires the result to be
identical to the original once its own entry is removed again.

That logic lives once, in `scripts/lib/desktop-config.mjs`, and both setup scripts call
it. `scripts/lib/read-live-config.mjs` is shared the same way. Two implementations of
something this careful drift apart, and the one that drifts is the one nobody is
running today.

The practical benefit is that the riskiest part of the macOS path is the best-tested
part: it is plain JSON and filesystem work, so it is covered by
`test/scripts/desktop-config.test.ts` and runs in CI on **both** platforms.

---

## What has actually been verified, and what has not

This project has learned what untested code is worth: the nutrition summary passed 365
tests and still had two bugs the first time it met real data. So this section is
precise about the boundary.

**Proven, on Windows and in CI on macOS**

- The Claude Desktop config writer — 21 tests covering every scenario the Windows
  PowerShell suite covers, plus its command-line entry point.
- The configuration validator — 22 tests, including every refusal the launcher relies
  on.
- Every parser, the coverage analysis and the MCP surface: 400-plus tests, all
  platform-neutral, run on `macos-latest` on every push.

**Proven on Windows only, by running the launcher against a stubbed permission check**

- Every refusal path in `run-mcp.sh` in order: unbuilt, unconfigured, unreadable
  configuration, live access disabled, a username carrying a newline, and a
  configuration written for the other platform. A valid configuration reaches exactly
  the Keychain call and no further.
- The mode check itself refuses `755`.

**Never run on a Mac. Verify these first.**

1. `security add-generic-password ... -w` with no value actually prompts, and the
   password round-trips back out through `find-generic-password`.
2. `chmod 700` holds, and the launcher refuses after a deliberate `chmod 755`.
3. `.session.json` appears at mode `600` — the one place where the Python `os.chmod`
   that is decorative on Windows is the real protection.
4. One live read, then one write and its undo: log something trivial, read it back,
   delete it, confirm it is gone.

Step 3 is the one most likely to reveal a genuine difference, because it is where the
two platforms use different mechanisms rather than the same mechanism spelled two ways.

If any of that fails, the fix belongs here rather than in a note on the side — this
file is the record of what is known to work.
