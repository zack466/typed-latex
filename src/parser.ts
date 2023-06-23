import { Token, Lexer } from "./lexer"
import { AssertionError, Enum } from "./util"

export class ParseError extends Error {
  override name = "ParseError";
  constructor(message: string) {
    super(message);
  }
}

export type TokenOrNode<TokenType, SyntaxKind> = Token<TokenType> | ParseTreeNode<TokenType, SyntaxKind>

// an untyped, homogenous parse tree (similar to a Rowan GreenNode)
export interface ParseTreeNode<TokenType, SyntaxKind> {
  // also keep track of parent?
  kind: SyntaxKind,
  children: TokenOrNode<TokenType, SyntaxKind>[],
}

// an easy interface for building parse trees (basically a zipper)
class ParseTreeBuilder<TokenType, SyntaxKind> {
  parents: [ParseTreeNode<TokenType, SyntaxKind>, number][]; // a stack of nodes to keep track of the current position in the tree
  children: TokenOrNode<TokenType, SyntaxKind>[]; // an accumulator for the children of the current node

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

  push(item: TokenOrNode<TokenType, SyntaxKind>) {
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
export class Parser<TokenType extends Enum, SyntaxKind extends Enum> {
  tokens: Token<TokenType>[];
  lexer: Lexer<TokenType>;
  idx: number;

  builder: ParseTreeBuilder<TokenType, SyntaxKind>;

  constructor(lexer: Lexer<TokenType>) {
    this.lexer = lexer;
    this.tokens = lexer.tokenize();
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
    const [row, col] = this.lexer.getSourceLocation(token.offset);
    if (token.type !== type) {
      throw new ParseError(`Expected token of type ${String(type)} at ${row}:${col}, found ${String(token.type)} instead`);
    }
    this.builder.push(token);
    this.idx++;
  }

  expect2(type1: TokenType, type2: TokenType) {
    let token = this.peek();
    const [row, col] = this.lexer.getSourceLocation(token.offset);
    if (token.type !== type1 && token.type !== type2) {
      throw new ParseError(`Expected token of type ${String(type1)} or ${String(type2)} at ${row}:${col}, found ${String(token.type)} instead`);
    }
    this.builder.push(token);
    this.idx++;
  }

  ignore() {
    this.idx++;
  }

  parse(): ParseTreeNode<TokenType, SyntaxKind> {
    throw new ParseError("Unimplemented")
  }
}

// https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
export function isToken<TokenType, SyntaxKind>(node: TokenOrNode<TokenType, SyntaxKind>): node is Token<TokenType> {
  return (node as Token<TokenType>).tokenData !== undefined;
}

export function isNode<TokenType, SyntaxKind>(node: TokenOrNode<TokenType, SyntaxKind>) {
  return !isToken(node);
}

export function concatParseTree<TokenType, SyntaxKind>(node: TokenOrNode<TokenType, SyntaxKind>): string {
  if (isToken(node)) {
    return node.source;
  } else {
    return node.children.map(concatParseTree).join("")
  }
}

export function concatParseTrees<TokenType, SyntaxKind>(nodes: TokenOrNode<TokenType, SyntaxKind>[]): string {
  return nodes.map(concatParseTree).join("")
}
