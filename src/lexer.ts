import { Maybe, Enum, assert } from "./util"

export class LexError extends Error {
  override name = "LexError";
  constructor(message: string) {
    super(message);
  }
}

export interface Token<TokenType> {
  type: TokenType,
  tokenData: any,
  source: string,
  offset: number,
}

// Something that is potentially able to generate a token, given a lexer's current state.
// Custom lexing functions are responsible for updating the index and offset of the lexer
// (and not updating those fields if lexing fails)
export type LexerFn<TokenType extends Enum> = RegExp | ((lexer: Lexer<TokenType>) => Maybe<Token<TokenType>>)

// a dictionary associating token types with their corresponding lexing function 
export type LexFns<TokenType extends Enum> = {
  [K in TokenType]: LexerFn<TokenType>;
}

export class Lexer<TokenType extends Enum> {
  lexFns: LexFns<TokenType>;

  source: string;
  index: number;
  offset: number;

  constructor(source: string, lexFns: LexFns<TokenType>) {
    this.source = source;
    this.lexFns = lexFns;

    this.index = 0;
    this.offset = 0;
  }

  hasNext() {
    return this.index < this.source.length;
  }

  // returns row and column value corresponding to an absolute offset in the text source.
  // offset is zero-indexed, returned row/col should be 1-indexed
  getSourceLocation(offset: number): [number, number] {
    if (offset < 0 || offset >= this.source.length) {
      throw new LexError(`Offset ${offset} out of bounds for source text of length ${this.source.length}`)
    }
    const lines = this.source.split("\n");

    // Iterate by row until we reach the desired index
    // This could probably replaced by a fancy binary search algorithm
    // but I don't think the extra performance is necessary as of now
    let row = 0
    let currOffset = 0;
    while (currOffset <= offset) {
      const currLine = lines[row]
      if (currOffset + currLine.length + 1 > offset) {
        const col = offset - currOffset;
        return [row + 1, col + 1]
      } else {
        currOffset += currLine.length + 1
        row++
      }
    }
    assert(false)
  }

  // The order of precedence (and the tokens that are actually checked for) is specified
  // using the types parameter.
  nextToken(): Maybe<Token<TokenType>> {
    if (this.index === this.source.length) {
      return null;
    }

    const N = Object.keys(this.lexFns).length
    // iterate through each lexFn in order determined by the TokenType enum
    for (const i of Array(N).keys()) {
      const lexFn = this.lexFns[i] as LexerFn<TokenType>

      if (lexFn instanceof RegExp) {
        // match regex
        let match = lexFn.exec(this.source.slice(this.index));
        if (match === null) {
          continue;
        }
        let captured = match[0];

        // construct token with info
        let token = {
          type: i,
          tokenData: null,
          source: this.source.slice(this.index, this.index + captured.length),
          offset: this.offset,
        } as Token<TokenType>;

        // iterate index/column/row counters
        this.offset += captured.length;
        this.index += captured.length;

        return token;

      } else {
        const tok = lexFn(this)
        if (tok !== null) {
          return tok
        }
      }
    }
    return null;
  }

  tokenize(): Token<TokenType>[] {
    let tokens: Token<TokenType>[] = [];

    while (true) {
      let token = this.nextToken();
      if (token === null) {
        break;
      } else {
        tokens.push(token);
      }
    }

    return tokens;
  }
}
