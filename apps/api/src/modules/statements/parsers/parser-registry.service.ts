import { Injectable, Logger } from '@nestjs/common';
import { StatementParser } from './statement-parser.interface';

@Injectable()
export class ParserRegistry {
  private readonly logger = new Logger(ParserRegistry.name);
  private parsers: Map<string, StatementParser> = new Map();

  /**
   * Register a parser implementation.
   * Called during app bootstrap.
   */
  register(parser: StatementParser): void {
    if (this.parsers.has(parser.institution)) {
      this.logger.warn(`Parser for ${parser.institution} is being overwritten`);
    }
    this.parsers.set(parser.institution, parser);
    this.logger.log(`Registered parser for ${parser.institution}`);
  }

  /**
   * Get a parser by institution name.
   */
  get(institution: string): StatementParser | null {
    return this.parsers.get(institution) || null;
  }

  /**
   * Auto-detect: iterate parsers in registration order,
   * return the first that matches the raw text.
   * Returns null if no parser matches.
   */
  detect(rawText: string): StatementParser | null {
    for (const parser of this.parsers.values()) {
      if (parser.detect(rawText)) {
        this.logger.log(`Auto-detected institution: ${parser.institution}`);
        return parser;
      }
    }
    return null;
  }

  /**
   * Get all registered parsers.
   */
  getAll(): StatementParser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * Get the number of registered parsers.
   */
  get count(): number {
    return this.parsers.size;
  }
}
