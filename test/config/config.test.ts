import { describe, expect, it } from 'vitest';

import {
  TIMEZONE_ENVIRONMENT_VARIABLE,
  readConfiguration,
} from '../../src/config/index.js';

describe('readConfiguration', () => {
  it('requires an explicit diary timezone', () => {
    expect(() => readConfiguration({})).toThrow(TIMEZONE_ENVIRONMENT_VARIABLE);
  });

  it('rejects a timezone name that Intl cannot interpret', () => {
    expect(() =>
      readConfiguration({ [TIMEZONE_ENVIRONMENT_VARIABLE]: 'Definitely/Not_A_Timezone' }),
    ).toThrow(/valid IANA timezone/);
  });

  it('accepts and trims an IANA timezone without guessing a default', () => {
    expect(
      readConfiguration({ [TIMEZONE_ENVIRONMENT_VARIABLE]: '  America/New_York  ' }),
    ).toEqual({ timeZone: 'America/New_York' });
  });
});
