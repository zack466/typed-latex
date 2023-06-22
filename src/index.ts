import { tokenize } from "./lexer";
import { Parser, concatParseTree } from "./parser"
import { assert } from "./util"

const text = "\\begin{document}\nHello, world!\n\\[1+1 = 2\\]\n\\end{document}"

function main() {
  let parser = new Parser(text);
  console.log(tokenize(text));
  let tree = parser.parse();
  console.log(tree);
  assert(text == concatParseTree(tree)); // since the parse tree is lossless
}

main();
