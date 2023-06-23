// Inspired by Texlab parser/lexer
import { Maybe, alphabetic, Enum, assert } from "./util"
import { Lexer, LexError, Token } from "./lexer"
import { Parser, ParseTreeNode, ParseError, isNode } from "./parser"

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

function isText(type: TokenType) {
  return [TokenType.Word, TokenType.LineBreak, TokenType.LineComment, TokenType.Whitespace, TokenType.Comma, TokenType.Pipe].includes(type);
}

function isCommand(token: Token<TokenType>, name: string) {
  return token.type === TokenType.Command && token.tokenData === name;
}

function isTrivia(type: TokenType) {
  return [TokenType.LineBreak, TokenType.LineComment, TokenType.Whitespace].includes(type);
}

export function lexCommand<TokenType extends Enum>(lexer: Lexer<TokenType>): Maybe<Token<TokenType>> {
  if (lexer.source[lexer.index] === "\\") {
    if (lexer.source.length == lexer.index + 1) {
      throw new LexError(`Unexpected EOF at ${lexer.offset}`)
    }
    let c = lexer.source[lexer.index + 1];

    if (!alphabetic(c)) {
      // one non-alphabetic character
      let token = {
        type: TokenType.Command,
        tokenData: c,
        source: lexer.source.slice(lexer.index, lexer.index + 2),
        offset: lexer.offset,
      } as Token<TokenType>;

      lexer.offset += 2;
      lexer.index += 2;

      return token;
    } else {
      // sequence of a-zA-Z characters
      let match = /^[a-zA-Z]+/.exec(lexer.source.slice(lexer.index + 1));
      if (match === null) {
        throw new LexError(`Unexpected \\ at ${lexer.offset}`)
      }
      let captured = match[0];

      let token = {
        type: TokenType.Command,
        tokenData: captured,
        source: lexer.source.slice(lexer.index, lexer.index + 1 + captured.length),
        offset: lexer.offset,
      } as Token<TokenType>;

      lexer.index += 1 + captured.length;
      lexer.offset += 1 + captured.length;

      return token;
    }
  }
  return null;
}

let lexFns = {
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
  [TokenType.Dollar]: /^\$\$?/,
  [TokenType.Command]: lexCommand,
}
export class LatexLexer extends Lexer<TokenType> {
  constructor(source: string) {
    super(source, lexFns)
  }

  static tokenize(text: string): Token<TokenType>[] {
    let tokens: Token<TokenType>[] = [];
    const lexer = new LatexLexer(text);

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

export enum SyntaxKind {
  Root,
  Begin,
  End,
  Environment,
  Formula,
  Equation,
  CurlyGroup,
  BracketGroup,
  MixedGroup,
  Command,
  Text,
}

export class LatexParser extends Parser<TokenType, SyntaxKind> {
  constructor(lexer: LatexLexer) {
    super(lexer);
  }
  expectCommand(name: string) {
    let token = this.peek();
    const [row, col] = this.lexer.getSourceLocation(token.offset);
    if (!isCommand(token, name)) {
      throw new ParseError(`Expected \\${name} at ${row}:${col}, found ${token.source} instead`);
    }
    this.builder.push(token);
    this.idx++;
  }

  trivia() {
    while (this.hasNext() && isTrivia(this.peek().type)) {
      this.consume();
    }
  }

  curly_group() {
    this.builder.start_node(SyntaxKind.CurlyGroup)
    this.expect(TokenType.LeftCurly);
    while (this.hasNext()) {
      let token = this.peek();
      if (token.type == TokenType.RightCurly) {
        break;
      }
      this.content();
    }
    this.expect(TokenType.RightCurly);
    this.builder.end_node()
  }

  bracket_group() {
    this.builder.start_node(SyntaxKind.BracketGroup)
    this.expect(TokenType.LeftBracket);
    while (this.hasNext()) {
      let token = this.peek();
      if (token.type == TokenType.RightCurly || token.type == TokenType.RightBracket || isCommand(token, "end")) {
        break;
      }
      this.content();
    }
    this.expect(TokenType.RightBracket);
    this.builder.end_node()
  }

  mixed_group() {
    this.builder.start_node(SyntaxKind.MixedGroup)
    this.expect2(TokenType.LeftParen, TokenType.LeftBracket);
    while (this.hasNext()) {
      let token = this.peek();
      if (token.type == TokenType.RightCurly || token.type == TokenType.RightParen || token.type == TokenType.RightBracket || isCommand(token, "end")) {
        break;
      }
      this.content();
    }
    this.expect2(TokenType.RightParen, TokenType.RightBracket);
    this.builder.end_node()
  }

  equation() {
    this.builder.start_node(SyntaxKind.Equation)
    this.consume();
    while (this.hasNext) {
      let token = this.peek();
      if (token.type == TokenType.RightCurly || isCommand(token, "end") || isCommand(token, "]")) {
        break;
      }
      this.content();
    }
    this.expectCommand("]");
    this.builder.end_node();
  }

  formula() {
    this.builder.start_node(SyntaxKind.Formula)
    this.consume();
    while (this.hasNext) {
      let token = this.peek();
      if (token.type == TokenType.RightCurly || token.type == TokenType.Dollar || isCommand(token, "end")) {
        break;
      }
      this.content();
    }
    this.expect(TokenType.Dollar);
    this.builder.end_node();
  }

  command() {
    this.builder.start_node(SyntaxKind.Command);
    this.consume();
    while (this.hasNext()) {
      let token = this.peek();
      switch (token.type) {
        case TokenType.Whitespace:
        case TokenType.LineBreak:
        case TokenType.LineComment: {
          this.consume();
          break;
        }
        case TokenType.LeftCurly: {
          this.curly_group();
          continue;
        }
        case TokenType.LeftBracket:
        case TokenType.LeftParen: {
          this.mixed_group();
          continue;
        }
        default:
          throw new ParseError("Unimplemented")
      }
      break;
    }
    this.builder.end_node();
  }

  begin() {
    this.builder.start_node(SyntaxKind.Begin);
    this.consume();
    this.trivia();

    let token = this.peek();
    if (token.type === TokenType.LeftCurly) {
      this.curly_group();
    }

    if (token.type === TokenType.LeftBracket) {
      this.bracket_group();
    }

    this.builder.end_node();
  }

  end() {
    this.builder.start_node(SyntaxKind.End);
    this.consume();
    this.trivia();

    let token = this.peek();
    if (token.type === TokenType.LeftCurly) {
      this.curly_group();
    }

    this.builder.end_node();
  }

  environment() {
    this.builder.start_node(SyntaxKind.Environment);
    this.begin();
    while (this.hasNext()) {
      let token = this.peek();
      if (token.type === TokenType.RightCurly || isCommand(token, "end")) {
        break
      }
      this.content();
    }
    this.end();
    this.builder.end_node();
  }

  text() {
    this.builder.start_node(SyntaxKind.Text);
    this.consume();
    while (this.hasNext() && isText(this.peek().type)) {
        this.consume();
    }
    this.builder.end_node();
  }

  content() {
    let token = this.peek();
    const [row, col] = this.lexer.getSourceLocation(token.offset);
    switch (token.type) {
      case TokenType.Whitespace:
      case TokenType.LineBreak:
      case TokenType.LineComment: {
        this.consume();
        break;
      }
      case TokenType.RightCurly:
      case TokenType.RightParen:
      case TokenType.RightBracket: {
        throw new ParseError(`Unmatched punctuation at ${row}:${col}`)
      }
      case TokenType.LeftCurly: {
        this.curly_group();
        break;
      }
      case TokenType.LeftParen:
      case TokenType.LeftBracket: {
        this.mixed_group();
        break;
      }
      case TokenType.Dollar: {
        this.formula();
        break;
      }
      case TokenType.Word: {
        this.text();
        break;
      }
      case TokenType.Eq:
      case TokenType.Pipe:
      case TokenType.Comma: {
        this.consume();
        break;
      }
      case TokenType.Command: {
        if (token.tokenData === "begin") {
          this.environment();
        } else if (token.tokenData === "[") {
          this.equation();
        } else {
          this.command();
        }
        break;
      }
      default:
        throw new ParseError("Unimplemented")
    }
  }

  parse(): ParseTreeNode<TokenType, SyntaxKind> {
    this.builder.start_node(SyntaxKind.Root);
    while (this.hasNext()) {
      this.content();
    }
    this.builder.end_node();
    let root = this.builder.finish();
    assert(isNode(root))
    return root as ParseTreeNode<TokenType, SyntaxKind>
  }
}
