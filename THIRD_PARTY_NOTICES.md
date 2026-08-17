# Third-party notices

The live connector's protocol client began as `cronometer-mcp` 2.0.3 by Paul Hoskins.
It is **vendored and modified**, at `python/vendor/cronometer_client.py`, rather than
installed as a dependency. The MIT licence permits this and requires the copyright and
permission notice below to travel with the copy, which is what this file is for.

Why it was vendored, plainly: upstream's last commit was 2026-03-08. By August it had
eight open issues and four unmerged pull requests, two of them fixing a Cronometer
change that had already broken food search outright. A pinned dependency cannot be
patched, and the fixes existed but were going nowhere. Vendoring made them applicable.

The header of the vendored file lists every deliberate difference from the original —
the food-search endpoint, the retry rules, the parse-failure behaviour, the removal of
the pickle session store. Two of those changes are adapted from public pull requests
against the upstream project by **alex-mark** (#8) and **auctionsjeff** (#6), with a
third from **varunsaravagi** (#2); a fourth, by **alexey-igrychev** (#1), was adopted
only in part, because its retry would have re-sent account-changing writes.

Credit where it is due: the GWT-RPC protocol work in that file is Paul Hoskins's, and
it is the hard part. This project would not exist without it.

## cronometer-mcp

Copyright (c) 2026 Paul Hoskins

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
