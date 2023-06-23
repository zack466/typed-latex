import { Token, TokenType, tokenize } from "./lexer"
import { AssertionError, assert } from "../util"

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
  Formula,
  Equation,
  CurlyGroup,
  BracketGroup,
  MixedGroup,
  Command,
  Text,
}

export type TokenOrNode = Token | ParseTreeNode

function isText(type: TokenType) {
  return [TokenType.Word, TokenType.LineBreak, TokenType.LineComment, TokenType.Whitespace, TokenType.Comma, TokenType.Pipe].includes(type);
}

function isCommand(token: Token, name: string) {
  return token.type === TokenType.Command && token.tokenData === name;
}

function isTrivia(type: TokenType) {
  return [TokenType.LineBreak, TokenType.LineComment, TokenType.Whitespace].includes(type);
}

// an untyped, homogenous parse tree (similar to a Rowan GreenNode)
export interface ParseTreeNode {
  // also keep track of parent?
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

  expectCommand(name: string) {
    let token = this.peek();
    if (!isCommand(token, name)) {
      throw new ParseError(`Expected \\${name} at ${token.row}:${token.column}, found ${token.source} instead`);
    }
    this.builder.push(token);
    this.idx++;
  }


  ignore() {
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

  parse(): ParseTreeNode {
    this.builder.start_node(SyntaxKind.Root);
    while (this.hasNext()) {
      this.content();
    }
    this.builder.end_node();
    let root = this.builder.finish();
    assert(!isToken(root))
    return root as ParseTreeNode
  }
}

// https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
export function isToken(node: TokenOrNode): node is Token {
  return (node as Token).tokenData !== undefined;
}

export function concatParseTree(node: TokenOrNode): string {
  if (isToken(node)) {
    return node.source;
  } else {
    return node.children.map(concatParseTree).join("")
  }
}

export function concatParseTrees(nodes: TokenOrNode[]): string {
  return nodes.map(concatParseTree).join("")
}
