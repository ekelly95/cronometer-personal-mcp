/**
 * RFC 4180 reading and writing. The only CSV logic in the project — CLAUDE.md
 * puts a hard boundary here, including for output: escaping a food name on the
 * way out is CSV logic, so `escapeCsvField` lives with the reader rather than
 * wherever it happens to be needed.
 */

export interface CsvRecord {
  readonly fields: readonly string[];
  /** 1-based physical line the record starts on. A quoted field may span more. */
  readonly line: number;
}

export interface CsvDocument {
  readonly header: CsvRecord | undefined;
  readonly records: readonly CsvRecord[];
  /** Set when a quoted field was never closed, naming the line it opened on. */
  readonly unterminatedQuoteAtLine: number | undefined;
}

const BOM = String.fromCharCode(0xfeff);

/**
 * DATA_MODEL.md §1 says exports are LF with no BOM, and the fixtures assert it.
 * Both are still tolerated here: by the time a file reaches this function it may
 * have been through a text editor, a mail client or a Windows checkout, and
 * refusing to read it over a line ending would help nobody.
 */
export function readCsv(input: string): CsvDocument {
  const text = (input.startsWith(BOM) ? input.slice(1) : input).replace(/\r\n/g, '\n');

  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let recordStarted = false;
  let line = 1;
  let recordLine = 1;
  let unterminatedQuoteAtLine: number | undefined;
  let i = 0;

  const beginRecord = (): void => {
    if (!recordStarted) {
      recordLine = line;
      recordStarted = true;
    }
  };

  while (i < text.length) {
    const c = text.charAt(i);

    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (c === '\n') line += 1;
      field += c;
      i += 1;
      continue;
    }

    if (c === '"' && field === '') {
      beginRecord();
      inQuotes = true;
      i += 1;
      continue;
    }

    if (c === ',') {
      beginRecord();
      fields.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (c === '\n') {
      beginRecord();
      fields.push(field);
      records.push({ fields, line: recordLine });
      fields = [];
      field = '';
      recordStarted = false;
      line += 1;
      i += 1;
      continue;
    }

    beginRecord();
    field += c;
    i += 1;
  }

  if (inQuotes) {
    // The rest of the file was swallowed by the unclosed quote. Report where it
    // started and drop the partial record rather than emit a field of debris.
    unterminatedQuoteAtLine = recordLine;
  } else if (recordStarted) {
    fields.push(field);
    records.push({ fields, line: recordLine });
  }

  const [header, ...rest] = records;
  return { header, records: rest, unterminatedQuoteAtLine };
}

/**
 * Characters that make a spreadsheet treat a cell as a formula. DATA_MODEL.md §5
 * rule 8 requires them to be neutralised on any CSV round-trip: food names are
 * database- and user-authored, and one beginning with `=` is a live payload the
 * moment the file is opened in Excel, Sheets or Numbers.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * C0 controls other than tab, newline and carriage return, plus DEL. Built from
 * a codepoint string because the characters themselves are invisible in source.
 */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]', 'g');

export function escapeCsvField(value: string): string {
  const cleaned = value.replace(CONTROL_CHARS, '');

  if (FORMULA_LEAD.test(cleaned)) {
    // A leading apostrophe is what spreadsheets read as "this cell is text". The
    // field is then quoted as well, so the apostrophe cannot be mistaken for the
    // start of anything else.
    return `"${`'${cleaned}`.replace(/"/g, '""')}"`;
  }

  if (/[",\n\r]/.test(cleaned) || cleaned !== cleaned.trim()) {
    return `"${cleaned.replace(/"/g, '""')}"`;
  }

  return cleaned;
}

export function formatCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(',');
}

export function formatCsv(rows: readonly (readonly string[])[]): string {
  return rows.map(formatCsvRow).join('\n') + '\n';
}
