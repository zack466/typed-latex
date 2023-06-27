import { intoNode } from "./parser"
import { LatexLexer, LatexParser, Environment } from "./latex"
import { BinOp, InfixOp, MathLexer, MathParser } from "./mathmode"

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
// latex();

function math() {
  const text = "a \\cup b \\cap c";
  const lexer = new MathLexer(text);
  const parser = new MathParser(lexer);
  const root = parser.parse();
  const binop = new BinOp(intoNode(root.children[0]));
  console.log(binop.lhs());
  console.log(InfixOp[binop.op()!]);
  console.log(binop.rhs());
}
math();
