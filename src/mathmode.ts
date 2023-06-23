import { Lexer, Token} from "./lexer"
import { lexCommand } from "./latex"
import { Maybe, alphabetic, Enum } from "./util"

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
  Ampersand,
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


function lexSymbol(lexer: Lexer<TokenType>): Maybe<Token<TokenType>> {
  let c = lexer.source[lexer.index]
  if (alphabetic(c)) {
    let token = {
      type: TokenType.Symbol,
      tokenData: c,
      source: lexer.source.slice(lexer.index, lexer.index + 1),
      offset: lexer.offset,
    } as Token<TokenType>;

    lexer.index += 1
    lexer.offset += 1

    return token;
  }
  return null;
}

const lexFns = {
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
  [TokenType.Ampersand]: /^\&/,
  [TokenType.Eq]: /^=/,
  [TokenType.Plus]: /^\+/,
  [TokenType.Minus]: /^\-/,
  [TokenType.Asterick]: /^\*/,
  [TokenType.LeftAngle]: /^\</,
  [TokenType.RightAngle]: /^\>/,
  [TokenType.Underscore]: /^\_/,
  [TokenType.Caret]: /^\^/,
  [TokenType.Number]: /^[0-9]+/,
  [TokenType.Symbol]: lexSymbol,
  [TokenType.Command]: lexCommand,
}

export class MathLexer extends Lexer<TokenType> {
  constructor(source: string) {
    super(source, lexFns)
  }

  static tokenize(text: string): Token<TokenType>[] {
    let tokens: Token<TokenType>[] = [];
    const lexer = new MathLexer(text);

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
}
