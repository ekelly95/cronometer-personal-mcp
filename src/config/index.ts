export const TIMEZONE_ENVIRONMENT_VARIABLE = 'CRONOMETER_TIMEZONE';
export const EXPORT_DIRECTORY_ENVIRONMENT_VARIABLE = 'CRONOMETER_EXPORT_DIR';

export interface AppConfiguration {
  readonly timeZone: string;
  /**
   * Where manually downloaded exports live, or absent if the launcher did not
   * supply one.
   *
   * Absent rather than defaulted on purpose. Guessing a directory for files that
   * contain a person's whole diary is the kind of convenience that ends with data
   * read from, or written to, somewhere nobody chose. The export tools say the
   * variable is unset; every other tool is unaffected.
   */
  readonly exportDirectory: string | undefined;
}

export function readConfiguration(
  environment: Readonly<NodeJS.ProcessEnv> = process.env,
): AppConfiguration {
  const timeZone = environment[TIMEZONE_ENVIRONMENT_VARIABLE]?.trim();
  if (timeZone === undefined || timeZone === '') {
    throw new Error(
      `${TIMEZONE_ENVIRONMENT_VARIABLE} is required. Set it to the Cronometer diary's IANA timezone, such as America/New_York.`,
    );
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
  } catch {
    throw new Error(
      `${TIMEZONE_ENVIRONMENT_VARIABLE} must be a valid IANA timezone, such as America/New_York.`,
    );
  }

  const exportDirectory = environment[EXPORT_DIRECTORY_ENVIRONMENT_VARIABLE]?.trim();
  return Object.freeze({
    timeZone,
    exportDirectory: exportDirectory === undefined || exportDirectory === '' ? undefined : exportDirectory,
  });
}
