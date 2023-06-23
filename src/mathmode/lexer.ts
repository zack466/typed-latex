import { Maybe, alphabetic, whitespace } from "../util"

export class LexError extends Error {
  override name = "LexError";
  constructor(message: string) {
    super(message);
  }
}

export enum TokenType {
  LineBreak,
  Whitespace,
  LeftCurly,
  RightCurly,
  LeftBracket,
  RightBracket,
  LeftParen,
  RightParen,
  Comma,
  Pipe,
  Eq,
  Plus,
  Minus,
  Asterick,
  LeftAngle,
  RightAngle,
  Underscore,
  Caret,
  Number, // sequence of digits
  Symbol, // a single alphabetic character
  Command,
}

let REGEX = {
  [TokenType.LineBreak]: /^\/\//,
  [TokenType.Whitespace]: /^[^\S\r\n]+/,
  [TokenType.LeftCurly]: /^\{/,
  [TokenType.RightCurly]: /^\}/,
  [TokenType.LeftBracket]: /^\[/,
  [TokenType.RightBracket]: /^\]/,
  [TokenType.LeftParen]: /^\(/,
  [TokenType.RightParen]: /^\)/,
  [TokenType.Comma]: /^,/,
  [TokenType.Pipe]: /^\|/,
  [TokenType.Eq]: /^=/,
  [TokenType.Plus]: /^\+/,
  [TokenType.Minus]: /^\-/,
  [TokenType.Asterick]: /^\*/,
  [TokenType.LeftAngle]: /^\</,
  [TokenType.RightAngle]: /^\>/,
  [TokenType.Underscore]: /^\_/,
  [TokenType.Caret]: /^\^/,
  [TokenType.Number]: /^[0-9]+/,
}

export interface Token {
  type: TokenType,
  tokenData: any,
  source: string,
  offset: number,
}

export class Lexer {
  source: string;
  index: number;
  offset: number;

  constructor(source: string) {
    this.source = source;
    this.index = 0;

    this.offset = 0;
  }

  command(): Maybe<Token> {
    // command name must consist of either one non-alphabetic character or only uppercase or lowercase alphabetic letters
    // source: https://tex.stackexchange.com/a/66671
    if (this.source[this.index] === "\\") {
      if (this.source.length == this.index + 1) {
        throw new LexError(`Unexpected EOF at ${this.offset}`)
      }
      let c = this.source[this.index + 1];

      if (!alphabetic(c)) {
        // one non-alphabetic character
        let token = {
          type: TokenType.Command,
          tokenData: c,
          source: this.source.slice(this.index, this.index + 2),
          offset: this.offset,
        } as Token;

        this.offset += 2;
        this.index += 2;

        return token;
      } else {
        // sequence of a-zA-Z characters
        let match = /^[a-zA-Z]+/.exec(this.source.slice(this.index + 1));
        if (match === null) {
          throw new LexError(`Unexpected \\ at ${this.offset}`)
        }
        let captured = match[0];

        let token = {
          type: TokenType.Command,
          tokenData: captured,
          source: this.source.slice(this.index, this.index + 1 + captured.length),
          offset: this.offset,
        } as Token;

        this.index += 1 + captured.length;
        this.offset += 1 + captured.length;

        return token;
      }
    }
    return null;
  }

  hasNext() {
    return this.index < this.source.length;
  }

  nextToken(): Maybe<Token> {
    if (this.index === this.source.length) {
      return null;
    }

    for (let type of [
      TokenType.LineBreak,
      TokenType.Whitespace,
      TokenType.LeftCurly,
      TokenType.RightCurly,
      TokenType.LeftBracket,
      TokenType.RightBracket,
      TokenType.LeftParen,
      TokenType.RightParen,
      TokenType.Comma,
      TokenType.Pipe,
      TokenType.Eq,
      TokenType.Plus,
      TokenType.Minus,
      TokenType.Asterick,
      TokenType.LeftAngle,
      TokenType.RightAngle,
      TokenType.Underscore,
      TokenType.Caret,
      TokenType.Number,
      TokenType.Symbol,
      TokenType.Command,
    ]) {
      if (type === TokenType.Command) {
        let tok = this.command();
        if (tok !== null) {
          return tok;
        }
      } else if (type === TokenType.Symbol) {
        let c = this.source[this.index]
        if (alphabetic(c)) {
          let token = {
            type: TokenType.Symbol,
            tokenData: c,
            source: this.source.slice(this.index, this.index + 1),
            offset: this.offset,
          } as Token;

          this.index += 1
          this.offset += 1

        return token;
        }
      } else {
        // match regex
        let match = REGEX[type].exec(this.source.slice(this.index));
        if (match === null) {
          continue;
        }
        let captured = match[0];

        // construct token with info
        let token = {
          type: type,
          tokenData: null,
          source: this.source.slice(this.index, this.index + captured.length),
          offset: this.offset,
        } as Token;

        // iterate index/column/row counters
        this.offset += captured.length;
        this.index += captured.length;

        return token;
      }
    }

    return null;
  }
}

export function tokenize(text: string): Token[] {
  let tokens: Token[] = [];
  let lexer = new Lexer(text);

  while (true) {
    let token = lexer.nextToken();
    if (token === null) {
      break;
    } else {
      tokens.push(token);
    }
  }

  return tokens;
}
