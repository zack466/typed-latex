import { Parser, concatParseTree } from "./parser"
import { assert } from "./util"

const text = "\\begin{document}\nHello, world!\n\\end{document}"

function main() {
  let parser = new Parser(text);
  let tree = parser.parse();
  console.log(tree);
  assert(text == concatParseTree(tree)); // since the parse tree is lossless
}

main();
