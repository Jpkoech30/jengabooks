import { ParserRegistry } from '../parsers/parser-registry.service';
import { MpesaParser } from '../parsers/mpesa.parser';
import { KcbParser } from '../parsers/kcb.parser';

describe('ParserRegistry', () => {
  let registry: ParserRegistry;
  let mpesaParser: MpesaParser;
  let kcbParser: KcbParser;

  const mpesaText = `M-PESA FULL STATEMENT
Organisation Name: Test
Shortcode: 12345`;

  const kcbText = `KCB BANK KENYA LTD
Account Number: 1234567890`;

  const unknownText = `Some random financial text without any bank markers`;

  beforeEach(() => {
    registry = new ParserRegistry();
    mpesaParser = new MpesaParser();
    kcbParser = new KcbParser();
  });

  describe('register', () => {
    it('should register a parser', () => {
      registry.register(mpesaParser);
      expect(registry.count).toBe(1);
    });

    it('should register multiple parsers', () => {
      registry.register(mpesaParser);
      registry.register(kcbParser);
      expect(registry.count).toBe(2);
    });

    it('should overwrite existing parser with same institution', () => {
      registry.register(mpesaParser);
      registry.register(mpesaParser); // Same parser again
      expect(registry.count).toBe(1);
    });
  });

  describe('get', () => {
    it('should return registered parser by institution', () => {
      registry.register(mpesaParser);
      const parser = registry.get('MPESA');
      expect(parser).toBe(mpesaParser);
    });

    it('should return null for unregistered institution', () => {
      const parser = registry.get('UNKNOWN');
      expect(parser).toBeNull();
    });
  });

  describe('detect', () => {
    it('should detect M-Pesa from text', () => {
      registry.register(mpesaParser);
      registry.register(kcbParser);
      const detected = registry.detect(mpesaText);
      expect(detected).toBe(mpesaParser);
    });

    it('should detect KCB from text', () => {
      registry.register(mpesaParser);
      registry.register(kcbParser);
      const detected = registry.detect(kcbText);
      expect(detected).toBe(kcbParser);
    });

    it('should return null for unknown text', () => {
      registry.register(mpesaParser);
      registry.register(kcbParser);
      const detected = registry.detect(unknownText);
      expect(detected).toBeNull();
    });

    it('should return null when no parsers registered', () => {
      const detected = registry.detect(mpesaText);
      expect(detected).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all registered parsers', () => {
      registry.register(mpesaParser);
      registry.register(kcbParser);
      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(mpesaParser);
      expect(all).toContain(kcbParser);
    });

    it('should return empty array when no parsers registered', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });
});
