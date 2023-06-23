// Inspired by Texlab parser/lexer
import { Maybe, alphabetic } from "../util"

export class LexError extends Error {
  override name = "LexError";
  constructor(message: string) {
    super(message);
  }
}

export enum TokenType {
  LineBreak,
  Whitespace,
  LineComment,
  LeftCurly,
  RightCurly,
  LeftBracket,
  RightBracket,
  LeftParen,
  RightParen,
  Comma,
  Pipe,
  Eq,
  Word,
  Dollar,
  Command,
}

let REGEX = {
  [TokenType.LineBreak]: /^[\r\n]+/,
  [TokenType.Whitespace]: /^[^\S\r\n]+/,
  [TokenType.LineComment]: /^%[^\r\n]*/,
  [TokenType.LeftCurly]: /^\{/,
  [TokenType.RightCurly]: /^\}/,
  [TokenType.LeftBracket]: /^\[/,
  [TokenType.RightBracket]: /^\]/,
  [TokenType.LeftParen]: /^\(/,
  [TokenType.RightParen]: /^\)/,
  [TokenType.Comma]: /^,/,
  [TokenType.Pipe]: /^\|/,
  [TokenType.Eq]: /^=/,
  [TokenType.Word]: /^[^\s\\%\{\},\$\[\]\(\)=\|]+/,
  [TokenType.Dollar]: /^\$\$?/
}

export interface Token {
  type: TokenType,
  tokenData: any,
  source: string,
  row: number,
  column: number,
}

export class Lexer {
  source: string;
  index: number;
  row: number;
  column: number;

  constructor(source: string) {
    this.source = source;
    this.index = 0;

    this.row = 1;
    this.column = 1;
  }

  command(): Maybe<Token> {
    // command name must consist of either one non-alphabetic character or only uppercase or lowercase alphabetic letters
    // source: https://tex.stackexchange.com/a/66671
    if (this.source[this.index] === "\\") {
      if (this.source.length == this.index + 1) {
        throw new LexError(`Unexpected EOF at ${this.row}:${this.column}`)
      }
      let c = this.source[this.index + 1];

      if (!alphabetic(c)) {
        // one non-alphabetic character
        let token = {
          type: TokenType.Command,
          tokenData: c,
          source: this.source.slice(this.index, this.index + 2),
          row: this.row,
          column: this.column,
        } as Token;

        this.column += 2;
        this.index += 2;

        return token;
      } else {
        // sequence of a-zA-Z characters
        let match = /^[a-zA-Z]+/.exec(this.source.slice(this.index + 1));
        if (match === null) {
          throw new LexError(`Unexpected \\ at ${this.row}:${this.column}`)
        }
        let captured = match[0];

        let token = {
          type: TokenType.Command,
          tokenData: captured,
          source: this.source.slice(this.index, this.index + 1 + captured.length),
          row: this.row,
          column: this.column,
        } as Token;

        this.column += 1 + captured.length;
        this.index += 1 + captured.length;

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
      TokenType.LineComment,
      TokenType.LeftCurly,
      TokenType.RightCurly,
      TokenType.LeftBracket,
      TokenType.RightBracket,
      TokenType.LeftParen,
      TokenType.RightParen,
      TokenType.Comma,
      TokenType.Pipe,
      TokenType.Eq,
      TokenType.Word,
      TokenType.Dollar,
      TokenType.Command,
    ]) {
      if (type === TokenType.Command) {
        return this.command();
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
          row: this.row,
          column: this.column,
        } as Token;

        // iterate index/column/row counters
        this.column += captured.length;
        this.index += captured.length;

        if (type == TokenType.LineBreak) {
          this.row += 1;
          this.column = 1;
        }

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
