import { describe, expect, it } from 'vitest';
import cases from '../../../../club-server/docs/api/word-template-cases.json';
import { checkXml, fillXml, type Values } from './wordTemplate';

// The engine's contract, shared with the server (WordTemplateTest): both must fill these alike.
describe('word template cases', () => {
  for (const c of cases as { name: string; xml: string; values: Values; expected?: string; check?: { unknown: string[]; blocks: string[] } }[]) {
    it(c.name, () => {
      if (c.check) expect(checkXml(c.xml, c.values)).toEqual(c.check);
      else expect(fillXml(c.xml, c.values)).toBe(c.expected);
    });
  }
});
