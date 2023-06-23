import { tokenize } from "./latex/lexer";
import { Parser, SyntaxKind, concatParseTree } from "./latex/parser"
import { Environment, findFirstNode } from "./latex/syntax";
import { assert } from "./util"

import { tokenize as mathTokenize } from "./mathmode/lexer"

const text = "\\begin{document}\nHello, world!\n\\[1+1 = 2\\]\n\\end{document}"

function main() {
  let parser = new Parser(text);
  // console.log(tokenize(text));
  let root = parser.parse();
  assert(text == concatParseTree(root)); // since the parse tree is lossless

  let documentNode = findFirstNode(root.children, SyntaxKind.Environment);
  let document = new Environment(documentNode!);
  console.log(document.bodyText())
}

function math() {
  let tokens = mathTokenize("2 +\t(2^ef * 4)");
  console.log(tokens);
}

// main();
math();
