import { Maybe, assert } from "./util"
import { ParseTreeNode, SyntaxKind, TokenOrNode, isToken } from "./parser"
import { Token, TokenType } from "./lexer"

function findFirstToken(arr: TokenOrNode[], type: TokenType): Maybe<Token> {
  for (let e of arr) {
    if (isToken(e) && e.type === type) {
      return e;
    }
  }
  return null;
}

function findFirstNode(arr: TokenOrNode[], kind: SyntaxKind): Maybe<ParseTreeNode> {
  for (let e of arr) {
    if (!isToken(e) && e.kind === kind) {
      return e;
    }
  }
  return null;
}

// a typed layer over parse tree nodes
interface ASTNode {
  syntax: ParseTreeNode,
  type: SyntaxKind,
}

class Begin implements ASTNode {
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

class End implements ASTNode {
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

class Environment implements ASTNode {
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
}
