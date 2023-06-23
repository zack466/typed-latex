import { Maybe, assert } from "../util"
import { ParseTreeNode, SyntaxKind, TokenOrNode, concatParseTrees, isToken } from "./parser"
import { Token, TokenType } from "./lexer"

export function findFirstToken(arr: TokenOrNode[], type: TokenType): Maybe<Token> {
  for (let e of arr) {
    if (isToken(e) && e.type === type) {
      return e;
    }
  }
  return null;
}

export function findFirstNode(arr: TokenOrNode[], kind: SyntaxKind): Maybe<ParseTreeNode> {
  for (let e of arr) {
    if (!isToken(e) && e.kind === kind) {
      return e;
    }
  }
  return null;
}

// a typed layer over parse tree nodes
export interface ASTNode {
  syntax: ParseTreeNode,
  type: SyntaxKind,
}

export class Begin implements ASTNode {
  syntax: ParseTreeNode;
  type: SyntaxKind.Begin;

  constructor(syntax: ParseTreeNode) {
    assert(syntax !== null);
    assert(syntax.kind === SyntaxKind.Begin);
    this.syntax = syntax;
  }

  name(): Maybe<string> {
    let tok = findFirstToken(this.syntax.children, TokenType.Word);
    return tok === null ? null : tok.source
  }
}

export class End implements ASTNode {
  syntax: ParseTreeNode;
  type: SyntaxKind.End;

  constructor(syntax: ParseTreeNode) {
    assert(syntax !== null);
    assert(syntax.kind === SyntaxKind.End);
    this.syntax = syntax;
  }

  name(): Maybe<string> {
    let tok = findFirstToken(this.syntax.children, TokenType.Word);
    return tok === null ? null : tok.source
  }
}

export class Environment implements ASTNode {
  syntax: ParseTreeNode;
  type: SyntaxKind.Environment;

  constructor(syntax: ParseTreeNode) {
    assert(syntax !== null);
    assert(syntax.kind === SyntaxKind.Environment)
    this.syntax = syntax;
  }

  begin(): Maybe<Begin> {
    let node = findFirstNode(this.syntax.children, SyntaxKind.Begin);
    if (node === null) {
      return null;
    }
    return new Begin(node);
  }

  end(): Maybe<End> {
    let node = findFirstNode(this.syntax.children, SyntaxKind.End);
    if (node === null) {
      return null;
    }
    return new End(node);
  }

  bodyText(): Maybe<string> {
    let begin = findFirstNode(this.syntax.children, SyntaxKind.Begin);
    let end = findFirstNode(this.syntax.children, SyntaxKind.End);
    if (begin === null || end === null) {
      return null;
    }
    let i = this.syntax.children.indexOf(begin);
    let j = this.syntax.children.indexOf(end);
    return concatParseTrees(this.syntax.children.slice(i + 1, j));
  }
}
