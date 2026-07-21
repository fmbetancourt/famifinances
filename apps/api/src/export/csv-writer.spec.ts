import { buildCsv, escapeCsvField } from './csv-writer';

const BOM = '﻿';

describe('csv-writer (EXP-01)', () => {
  describe('escapeCsvField', () => {
    it('leaves a plain field unquoted', () => {
      expect(escapeCsvField('Alimentación')).toBe('Alimentación');
    });

    it('quotes a field containing a comma', () => {
      expect(escapeCsvField('Feria, semanal')).toBe('"Feria, semanal"');
    });

    it('quotes and doubles inner double quotes', () => {
      expect(escapeCsvField('válvula 3" nueva')).toBe('"válvula 3"" nueva"');
    });

    it('quotes a field containing a newline', () => {
      expect(escapeCsvField('linea1\nlinea2')).toBe('"linea1\nlinea2"');
    });
  });

  describe('buildCsv', () => {
    it('prefixes a BOM, uses commas and CRLF, and ends with CRLF', () => {
      const csv = buildCsv(['A', 'B'], [['1', '2']]);
      expect(csv).toBe(`${BOM}A,B\r\n1,2\r\n`);
    });

    it('emits a header-only file for zero rows', () => {
      const csv = buildCsv(['Fecha', 'Monto'], []);
      expect(csv).toBe(`${BOM}Fecha,Monto\r\n`);
    });

    it('escapes fields with separators and preserves accents', () => {
      const csv = buildCsv(
        ['Nota'],
        [['Cañería, "urgente"']],
      );
      expect(csv).toBe(`${BOM}Nota\r\n"Cañería, ""urgente"""\r\n`);
    });
  });
});
