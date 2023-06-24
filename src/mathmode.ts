import { Lexer, Token} from "./lexer"
import { lexCommand } from "./latex"
import { Maybe, alphabetic, assert } from "./util"
import { ParseTreeNode, Parser, ParseError } from "./parser"

// Lexing
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

// Parsing
export enum SyntaxKind {
  Literal,
  Operation, // anything that takes one or more arguments and returns a value
  Symbol, // single alphabet characters OR specific commands (such as \gamma or \mathbb{R})
  Grouping, // an expression surrounded by parentheses, brackets, or curly brackets
  Equal,
  Frac,
  Command, // a generic command (treated as a no-op for now)
}

export enum InfixOp {
  Plus,
  Minus,
  Times,
  Power,
  Subscript,
  Superscript,
  Le, // <
  Ge, // >
  // TODO: set operations, boolean operations
}

export enum UnaryOp {
  Minus,
}

// Ambigious syntax?
// ex: f(5x) treated as a function call or f * 5 * x?
// Also, in aligns, need to treat newlines and ampersand as separators so something
// like "ax + b\\ cx + d" does not get interpreted as ax + bcx + d

// a basic recursive descent parser with pratt parsing for operator precedence
export class MathParser extends Parser<TokenType, SyntaxKind> {
  constructor(lexer: MathLexer) {
    super(lexer);
  }

  expression() {
    let token = this.peek();
    const [row, col] = this.lexer.getSourceLocation(token.offset);
    switch (token.type) {
      case TokenType.LineBreak:
      case TokenType.Whitespace: {
        this.consume();
        break;
      }
      case TokenType.RightCurly:
      case TokenType.RightParen:
      case TokenType.RightBracket: {
        throw new ParseError(`Unmatched grouping at ${row}:${col}`)
      }
      case TokenType.Eq:
      case TokenType.Plus:
      case TokenType.Minus:
      case TokenType.Asterick:
      case TokenType.LeftAngle:
      case TokenType.RightAngle:
      case TokenType.Underscore:
      case TokenType.Caret: {
        // check current parsing precedence
        throw new ParseError(`Unexpected punctuation at ${row}:${col}`)
      }
      case TokenType.Comma:
      case TokenType.Pipe:
      case TokenType.Ampersand:  {
        throw new ParseError(`Unexpected punctuation at ${row}:${col}`)
      }
      case TokenType.LeftCurly:
      case TokenType.LeftParen:
      case TokenType.LeftBracket: {
        // parse grouping, then try parsing an operator
      }
      case TokenType.Number:
      case TokenType.Symbol: {
        // parse number/symbol, then try parsing an operator
      }
      case TokenType.Command: {
        if (token.tokenData === "frac") {
          // parse fraction
        }
        break;
      }
      default:
        throw new ParseError("Unimplemented")
    }
  }

  parse(): ParseTreeNode<TokenType, SyntaxKind> {
  }
}
