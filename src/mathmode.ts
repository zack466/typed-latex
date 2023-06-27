import { Lexer, Token} from "./lexer"
import { lexCommand } from "./latex"
import { Maybe, alphabetic, assert } from "./util"
import { ParseTreeNode, Parser, ParseError, TokenOrNode, ASTNode, isToken } from "./parser"

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
  Symbol, // single alphabet characters OR specific commands (such as \gamma or \mathbb{R})
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

function isTrivia(type: TokenType) {
  return [TokenType.LineBreak, TokenType.Whitespace].includes(type);
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
// TODO: how to deal with duplication between syntaxkind and tokentype?
export enum SyntaxKind {
  Root,
  BinOp,
  Grouping, // an expression surrounded by parentheses, brackets, or curly brackets
  Literal,
  Symbol,
  Equal,
  Frac,
  Command, // a generic command (treated as a no-op for now)
  Expression, // essentially an OR of all the existing operations
}

// TODO: implicit multiplication for symbols next to each other
export enum InfixOp {
  Plus,
  Minus,
  Times, // *, cdot
  Le, // <
  Ge, // >
  Subscript, // _
  Superscript, // ^
  In, // \in
  Union, // \in
  Intersection, // \in
  // TODO: set operations, boolean operations
}
// TODO: should we have support for chaining inequalities?


function matchingBrace(type: TokenType) {
  switch (type) {
    case TokenType.LeftParen:
      return TokenType.RightParen;
    case TokenType.LeftCurly:
      return TokenType.RightCurly;
    case TokenType.LeftBracket:
      return TokenType.RightBracket;
    case TokenType.RightParen:
      return TokenType.LeftParen;
    case TokenType.RightCurly:
      return TokenType.LeftCurly;
    case TokenType.RightBracket:
      return TokenType.LeftBracket;
    default:
      assert(false);
  }
}

// TODO: add rest of infix ops
// TODO: figure out a better way of encoding all of this information
function tokenToInfixOp(token: Token<TokenType>): Maybe<InfixOp> {
  switch (token.type) {
    case TokenType.Plus: {
      return InfixOp.Plus;
    }
    case TokenType.Minus: {
      return InfixOp.Minus;
    }
    case TokenType.Asterick: {
      return InfixOp.Times;
    }
    case TokenType.LeftAngle: {
      return InfixOp.Le;
    }
    case TokenType.RightAngle: {
      return InfixOp.Ge;
    }
    case TokenType.Underscore: {
      return InfixOp.Subscript;
    }
    case TokenType.Caret: {
      return InfixOp.Superscript;
    }
    case TokenType.Command: {
      switch (token.tokenData) {
        case "in": {
          return InfixOp.In;
        }
        case "cup": {
          return InfixOp.Union;
        }
        case "cap": {
          return InfixOp.Intersection;
        }
        default: {
          return null;
        }
      }
    }
    default: {
      return null;
    }
  }
}

export enum UnaryOp {
  Minus,
  // TODO: boolean not
}

// assigns a precedence to each infix operator, with support for left/right associativity
// reference: https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
export const PRECEDENCE = {
  // leave some space for new more operators that might go in between
  [InfixOp.Union]: [78, 79],
  [InfixOp.Intersection]: [80, 81],
  [InfixOp.Le]: [90, 91],
  [InfixOp.Ge]: [90, 91],
  [InfixOp.Plus]: [100, 101],
  [InfixOp.Minus]: [100, 101],
  [InfixOp.Times]: [102, 103],
  [InfixOp.Superscript]: [104, 105],
  [InfixOp.Subscript]: [104, 105],
}

// Ambigious syntax?
// ex: f(5x) treated as a function call or f * 5 * x?
// Also, in aligns, need to treat newlines and ampersand as separators so something
// like "ax + b\\ cx + d" does not get interpreted as ax + bcx + d

// a basic recursive descent parser with pratt parsing for operator precedence
// other precedence levels (like =) will probably be through the grammar
export class MathParser extends Parser<TokenType, SyntaxKind> {
  constructor(lexer: MathLexer) {
    super(lexer);

    // ignore whitespace for parsing purposes
    this.tokens = this.tokens.filter((tok) => !isTrivia(tok.type));
  }

  // returns either Op(lhs, infix, rhs) or just a token
  expression(precedence: number): TokenOrNode<TokenType, SyntaxKind> {
    let lhs: TokenOrNode<TokenType, SyntaxKind> = this.peek()!;
    const [row, col] = this.lexer.getSourceLocation(lhs.offset);
    switch (lhs.type) {
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
        this.builder.start_node(SyntaxKind.Grouping);
        this.ignore();
        this.builder.push(this.expression(0));
        this.builder.end_node();
        this.expectIgnore(matchingBrace(lhs.type));
        lhs = this.builder.children.pop()!;
        break;
      }
      case TokenType.Number: {
        this.ignore();
        break;
      }
      case TokenType.Symbol: {
        this.ignore();
        break;
        // TODO: if sees left paren, parse function call or multiplication?
        // for now: parse as function call, if function not defined, then assume multiplication
        // parse number/symbol, then try parsing an operator
      }
      case TokenType.Command: {
        if (lhs.tokenData === "frac") {
          // parse fraction
        }
        break;
      }
      default:
        throw new ParseError("Unimplemented")
    }

    // Left associativity comes from while loop
    // Right associativity comes from recursion
    while (true) {
      const infix = this.peek(); // check for infix operator
      if (infix === null) {
        return lhs;
      }

      const infixOp = tokenToInfixOp(infix);
      if (infixOp === null) {
        break;
      }

      // TODO: unary expressions (prefix precedence)
      const [leftPrec, rightPrec] = PRECEDENCE[infixOp];
      if (leftPrec < precedence) {
        return lhs;
      }

      // this kinda abuses the tree builder, but it's fine
      this.builder.start_node(SyntaxKind.BinOp);

      this.builder.push(lhs);
      this.builder.push(infix);
      this.ignore(); // skip infix token

      let rhs = this.expression(rightPrec); // try to parse rest of expression
      this.builder.push(rhs);

      this.builder.end_node();
      lhs = this.builder.children.pop()!;
      // after this line, the tree builder should have the same state as before
    }

    return lhs;
  }

  // for now, parses a single expression
  parse(): ParseTreeNode<TokenType, SyntaxKind> {
    this.builder.start_node(SyntaxKind.Root);
    const expr = this.expression(0);
    this.builder.push(expr);
    this.builder.end_node();
    return this.builder.children[0] as ParseTreeNode<TokenType, SyntaxKind>;
  }
}

export class Literal implements ASTNode<TokenType, SyntaxKind> {
  syntax: Token<TokenType>;
  type: SyntaxKind.Literal;

  constructor(syntax: Token<TokenType>) {
    assert(syntax !== null);
    this.syntax = syntax;
  }

  value() {
    return parseInt(this.syntax.tokenData);
  }
}

export class Symbol implements ASTNode<TokenType, SyntaxKind> {
  syntax: Token<TokenType>;
  type: SyntaxKind.Symbol;

  constructor(syntax: Token<TokenType>) {
    assert(syntax !== null);
    this.syntax = syntax;
  }

  name() {
    return this.syntax.tokenData;
  }
}

export class BinOp implements ASTNode<TokenType, SyntaxKind> {
  syntax: ParseTreeNode<TokenType, SyntaxKind>;
  type: SyntaxKind.BinOp;

  constructor(syntax: ParseTreeNode<TokenType, SyntaxKind>) {
    assert(syntax !== null);
    assert(syntax.kind === SyntaxKind.BinOp)
    this.syntax = syntax;
  }

  static into(syntax: TokenOrNode<TokenType, SyntaxKind>) {
    if (isToken(syntax)) {
      return null;
    }
    if (syntax !== null && syntax.kind === SyntaxKind.BinOp) {
      if (syntax.children.length === 3 && isToken(syntax.children[1]) && tokenToInfixOp(syntax.children[1]) !== null) {
        return new BinOp(syntax);
      }
    }
    return null;
  }

  op() {
    return tokenToInfixOp(this.syntax.children[1] as Token<TokenType>);
  }

  lhs() {
    // try into number
    if (isToken(this.syntax.children[0]) && this.syntax.children[0].type === TokenType.Number) {
      return new Literal(this.syntax.children[0]);
    }
    // try into symbol
    if (isToken(this.syntax.children[0]) && this.syntax.children[0].type === TokenType.Symbol) {
      return new Symbol(this.syntax.children[0]);
    }
    // try into binop
    const result = BinOp.into(this.syntax.children[0]);
    if (result !== null) {
      return result;
    }
    return null;
  }

  rhs() {
    // try into number
    if (isToken(this.syntax.children[2]) && this.syntax.children[2].type === TokenType.Number) {
      return new Literal(this.syntax.children[2]);
    }
    // try into symbol
    if (isToken(this.syntax.children[2]) && this.syntax.children[2].type === TokenType.Symbol) {
      return new Symbol(this.syntax.children[2]);
    }
    // try into binop
    const result = BinOp.into(this.syntax.children[2]);
    if (result !== null) {
      return result;
    }
    return null;
  }
}

export type Math = Literal | Symbol | BinOp
