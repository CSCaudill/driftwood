import { describe, expect, it } from 'vitest';
import { appendDictation, formatDuration } from './speech';

describe('appendDictation', () => {
  it('capitalises and punctuates a first phrase', () => {
    expect(appendDictation('', 'we went to the lake')).toBe('We went to the lake.');
  });
  it('joins phrases with a space', () => {
    expect(appendDictation('We went to the lake.', 'it was cold')).toBe('We went to the lake. It was cold.');
  });
  it('continues a sentence that has no ending punctuation', () => {
    expect(appendDictation('We went to the lake and', 'it was cold')).toBe('We went to the lake and it was cold.');
  });
  it('keeps existing punctuation and ignores empty phrases', () => {
    expect(appendDictation('Hi.', 'really?')).toBe('Hi. Really?');
    expect(appendDictation('Hi.', '  ')).toBe('Hi.');
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_400)).toBe('1:05');
  });
});
