import { Parser } from "./parser"

const text = "\\begin{document}\nHello, world!\n\\end{document}"

function main() {
  let parser = new Parser(text);
  console.log(JSON.stringify(parser.parse()));
}

main();
