import { createInterface } from 'node:readline';

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let active = 0;

for await (const line of lines) {
  const request = JSON.parse(line);
  active += 1;
  const delay = request.method === 'slow' ? 100 : Number(request.params?.delay ?? 0);

  // A reply that never terminates its line. The parent has to notice while the
  // buffer is still growing; waiting for a newline that never arrives is the
  // failure this mode exists to provoke.
  if (request.params?.unterminated) {
    process.stdout.write('x'.repeat(Number(request.params.unterminated)));
    continue;
  }

  setTimeout(() => {
    let result;
    if (request.params?.oversized) {
      result = { blob: 'x'.repeat(256) };
    } else if (request.params?.reportEnvironment) {
      result = { environmentKeys: Object.keys(process.env).sort() };
    } else {
      result = { method: request.method, params: request.params, active };
    }
    process.stdout.write(`${JSON.stringify({ id: request.id, ok: true, result })}\n`);
    active -= 1;
  }, delay);
}
