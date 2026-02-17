export const log = {
  info: (msg: string): void => {
    console.log(msg);
  },

  success: (msg: string): void => {
    console.log(`✓ ${msg}`);
  },

  warn: (msg: string): void => {
    console.log(`⚠ ${msg}`);
  },

  error: (msg: string): void => {
    console.error(`✗ ${msg}`);
  },

  table: (headers: string[], rows: string[][]): void => {
    // Calculate column widths
    const colWidths = headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map((row) => (row[i] ?? '').length));
      return Math.max(header.length, maxRowWidth);
    });

    // Format header row
    const headerRow = headers
      .map((header, i) => header.padEnd(colWidths[i]!))
      .join(' | ');
    console.log(headerRow);

    // Separator line
    const separator = colWidths.map((width) => '-'.repeat(width)).join('-+-');
    console.log(separator);

    // Format data rows
    rows.forEach((row) => {
      const formattedRow = row
        .map((cell, i) => (cell ?? '').padEnd(colWidths[i]!))
        .join(' | ');
      console.log(formattedRow);
    });
  },
};
