import { intoNode } from "./parser"
import { LatexLexer, LatexParser, Environment } from "./latex"
import { MathLexer } from "./mathmode"

function latex() {
  const text = "\\begin{document}\nHello, world!\n\\[1+1 = 2\\]\n\\end{document}"
  // const tokens = LatexLexer.tokenize(text);
  // console.log(tokens)

  const lexer = new LatexLexer(text);
  const parser = new LatexParser(lexer);
  const root = parser.parse()
  const env = new Environment(intoNode(root.children[0]))
  console.log(env.bodyText());
}
latex();

function math() {
  const text = "\\gamma = 2+2";
  const lexer = new MathLexer(text);
  const tokens = lexer.tokenize();
  console.log(tokens)
}
// math();
