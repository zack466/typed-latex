# typed-latex

Lexing/parsing is heavily inspired by [Texlab](https://github.com/latex-lsp/texlab/tree/master) and [Rowan](https://github.com/rust-analyzer/rowan).
It might be overkill, but I'd rather have good parsing than bad (even if it's not necessarily required).

## Running

Currently uses [Bun](https://bun.sh/) to execute Typescript code without any annoying configuration.
Run `index.ts` with `make run`.

## Architecture

Currently, the code in `lexer.ts`, `parser.ts` are for parsing LaTeX into a nice representation to work with.
You can find the code for parsing LaTeX and LaTeX math mode in `latex.ts` and `mathmode.ts`, respectively.
Essentially, the LaTeX parser will be used to understand the overall structure of a LaTeX file, and the content inside math environments will be reconstructed and re-parsed in math mode for further processing.
