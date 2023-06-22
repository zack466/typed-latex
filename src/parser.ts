import { Token, TokenType, tokenize } from "./lexer"
import { AssertionError, assert } from "./util"

export class ParseError extends Error {
  override name = "ParseError";
  constructor(message: string) {
    super(message);
  }
}

export enum SyntaxKind {
  // syntax
  Root,
  Begin,
  End,
  Environment,
  Math,
  CurlyGroup,
  BracketGroup,
  MixedGroup,
  Command,
}

type TokenOrNode = Token | ParseTreeNode

// an untyped, homogenous parse tree (similar to a Rowan GreenNode)
interface ParseTreeNode {
  kind: SyntaxKind,
  children: TokenOrNode[],
}

// an easy interface for building parse trees (basically a zipper)
class ParseTreeBuilder {
  parents: [ParseTreeNode, number][]; // a stack of nodes to keep track of the current position in the tree
  children: TokenOrNode[]; // an accumulator for the children of the current node

  constructor() {
    this.parents = [];
    this.children = [];
  }

  start_node(kind: SyntaxKind) {
    let node = {
      kind: kind,
      children: [],
    }
    this.parents.push([node, this.children.length]);
  }

  end_node() {
    let result = this.parents.pop();
    if (result === undefined) {
      throw new AssertionError("Unmatched end_node()");
    }
    let [parent, child_idx] = result;
    parent.children = this.children.splice(child_idx);
    this.children.push(parent);
  }

  push(item: TokenOrNode) {
    this.children.push(item);
  }

  finish() {
    if (this.parents.length !== 0) {
      throw new AssertionError("Could not finish building tree: unmatched start_node");
    }
    return this.children[0];
  }
}

// produces an untyped parse tree
// further processing is required to generate an abstract syntax tree
export class Parser {
  tokens: Token[];
  idx: number;

  builder: ParseTreeBuilder;

  constructor(text: string) {
    this.tokens = tokenize(text);
    this.builder = new ParseTreeBuilder();
    this.idx = 0;
  }

  hasNext() {
    return this.idx < this.tokens.length;
  }

  peek() {
    return this.tokens[this.idx];
  }

  consume() {
    let token = this.peek();
    this.builder.push(token);
    this.idx++;
  }

  expect(type: TokenType) {
    let token = this.peek();
    if (token.type !== type) {
      throw new ParseError(`Expected token of type ${TokenType[type]} at ${token.row}:${token.column}, found ${TokenType[token.type]} instead`);
    }
    this.builder.push(token);
    this.idx++;
  }

  expect2(type1: TokenType, type2: TokenType) {
    let token = this.peek();
    if (token.type !== type1 && token.type !== type2) {
      throw new ParseError(`Expected token of type ${TokenType[type1]} or ${TokenType[type2]} at ${token.row}:${token.column}, found ${TokenType[token.type]} instead`);
    }
    this.builder.push(token);
    this.idx++;
  }

  ignore() {
    this.idx++;
  }

  trivia() {
    while (this.hasNext()) {
      let token = this.peek();
      if (token.type == TokenType.LineBreak || token.type == TokenType.Whitespace || token.type == TokenType.LineComment) {
        this.consume();
      } else {
        break;
      }
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
      if (token.type == TokenType.RightCurly || token.type == TokenType.RightBracket || (token.type == TokenType.Command && token.tokenData === "end")) {
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
      if (token.type == TokenType.RightCurly || token.type == TokenType.RightParen || token.type == TokenType.RightBracket || (token.type == TokenType.Command && token.tokenData === "end")) {
        break;
      }
      this.content();
    }
    this.expect2(TokenType.RightParen, TokenType.RightBracket);
    this.builder.end_node()
  }

  math() {
    this.builder.start_node(SyntaxKind.Math)
    while (this.hasNext) {
      let token = this.peek();
      if (token.type == TokenType.RightCurly || token.type == TokenType.Dollar || (token.type == TokenType.Command || token.tokenData === "end")) {
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
      if (token.type === TokenType.RightCurly || (token.type == TokenType.Command || token.tokenData === "end")) {
        break
      }
      this.content();
    }
    this.end();
    this.builder.end_node();
  }

  content() {
    let token = this.peek();
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
        throw new ParseError(`Unmatched punctuation at ${token.row}:${token.column}`)
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
        this.math();
        break;
      }
      case TokenType.Word:
      case TokenType.Eq:
      case TokenType.Pipe:
      case TokenType.Comma: {
        this.consume();
        break;
      }
      case TokenType.Command: {
        if (token.tokenData === "begin") {
          this.environment();
        } else {
          this.command();
        }
        break;
      }
      default:
        throw new ParseError("Unimplemented")
    }
  }

  parse() {
    this.builder.start_node(SyntaxKind.Root);
    while (this.hasNext()) {
      this.content();
    }
    this.builder.end_node();
    return this.builder.finish();
  }
}

// https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
function isToken(node: TokenOrNode): node is Token {
  return (node as Token).tokenData !== undefined;
}

export function concatParseTree(node: TokenOrNode): string {
  if (isToken(node)) {
    return node.source;
  } else {
    return node.children.map(concatParseTree).join("")
  }
}
