// Edit this file and then src and bindings are generated using the tree-sitter cli
// for inspiration see: https://github.com/tree-sitter/tree-sitter-javascript/blob/master/grammar.js#L1194
module.exports = grammar({
  name: "cel",
  // see: https://tree-sitter.github.io/tree-sitter/creating-parsers#keyword-extraction
  conflicts: ($) => [[$.number_literal]],

  precedences: ($) => [
    [
      "member",
      "call",
      "unary",
      "binary_multiply",
      "binary_plus",
      "binary_compare",
      "logical_and",
      "logical_or",
      "conditional",
      "ternary",
    ],
    ["member", "call", $.expression],
  ],

  extras: ($) => [
    $.comment,
    // TODO: is this exhaustive?
    /\s/,
  ],

  rules: {
    source_file: ($) => $.expression,
    identifier: ($) => /[_a-zA-Z][_a-zA-Z0-9]*/,
    null: ($) => "null",
    true: ($) => "true",
    false: ($) => "false",
    expression: ($) =>
      choice(
        $.primary_expression,
        $.binary_expression,
        $.unary_expression,
        $.ternary_expression
      ),
    unary_expression: ($) =>
      prec.left(
        "unary",
        seq(
          field("operator", choice("!", "-")),
          field("argument", $.expression)
        )
      ),
    primary_expression: ($) =>
      choice(
        $.subscript_expression,
        $.member_expression,
        $.parenthesized_expression,
        $.number_literal,
        $.string,
        $.true,
        $.false,
        $.null,
        $.identifier,
        $.list,
        $.message,
        $.map,
        $.call_expression
      ),
    parenthesized_expression: ($) => seq("(", $.expression, ")"),
    ternary_expression: ($) =>
      prec.right(
        "ternary",
        seq($.expression, "?", $.expression, ":", $.expression)
      ),
    member_expression: ($) =>
      prec(
        "member",
        seq(choice($.expression, $.primary_expression), ".", $.identifier)
      ),
    subscript_expression: ($) =>
      prec.right(
        "member",
        seq(choice($.expression, $.primary_expression), "[", $.expression, "]")
      ),
    // comment: ($) => token(seq("//", /.*/)),
    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    comment: (_) => token(seq("//", /(\\+(.|\r?\n)|[^\\\n])*/)),
    map: ($) =>
      seq(
        "{",
        optional(
          prec.left(
            seq(
              $.expression,
              ":",
              $.expression,
              repeat(seq(",", $.identifier, ":", $.expression))
            )
          )
        ),
        optional(","),
        "}"
      ),
    list: ($) =>
      seq(
        "[",
        optional(prec.left(seq($.expression, repeat(seq(",", $.expression))))),
        optional(","),
        "]"
      ),
    message: ($) =>
      seq(
        $.identifier,
        "{",
        optional(
          prec.left(
            seq(
              $.expression,
              ":",
              $.expression,
              repeat(seq(",", $.identifier, ":", $.expression))
            )
          )
        ),
        optional(","),
        "}"
      ),
    string: ($) =>
      seq(
        optional(choice("b", "B")),
        optional(choice("r", "R")),
        choice(
          seq(
            `"""`,
            repeat(
              choice(
                alias($._multi_line_double_string, $.string_content),
                $.escape_sequence
              )
            ),
            `"""`
          ),
          seq(
            `'''`,
            repeat(
              choice(
                alias($._multi_line_single_string, $.string_content),
                $.escape_sequence
              )
            ),
            `'''`
          ),
          seq(
            `"`,
            repeat(
              choice(
                alias(token.immediate(prec(1, /[^"\\\n]+/)), $.string_content),
                $.escape_sequence
              )
            ),
            `"`
          ),
          seq(
            `'`,
            repeat(
              choice(
                alias(token.immediate(prec(1, /[^\\'\n]+/)), $.string_content),
                $.escape_sequence
              )
            ),
            `'`
          )
        )
      ),
    _multi_line_double_string: ($) => {
      // via: https://github.com/tree-sitter/tree-sitter-java/blob/0b3f9cfe10a973df0530533313fdbef6c2c92bfa/grammar.js#L181C7-L184C10
      return prec.right(choice(/[^"]+/, seq(/"[^"]*/, repeat(/[^"]+/))));
    },
    _multi_line_single_string: ($) => {
      // via: https://github.com/tree-sitter/tree-sitter-java/blob/0b3f9cfe10a973df0530533313fdbef6c2c92bfa/grammar.js#L181C7-L184C10
      return prec.right(choice(/[^']+/, seq(/'[^']*/, repeat(/[^']+/))));
    },
    escape_sequence: ($) =>
      token(
        prec(
          1,
          seq(
            "\\",
            // TODO: these are probably inaccurate
            choice(
              /[^xuU]/,
              /\d{2,3}/,
              /x[0-9a-fA-F]{2,}/,
              /u[0-9a-fA-F]{4}/,
              /U[0-9a-fA-F]{8}/
            )
          )
        )
      ),

    call_expression: ($) => prec("call", seq($.expression, $.arguments)),
    arguments: ($) =>
      seq(
        "(",
        optional(seq($.expression, repeat(seq(",", $.expression)))),
        ")"
      ),
    binary_expression: ($) => {
      // thinking about associativity: https://stackoverflow.com/a/25830499/3720597
      return choice(
        prec.left(
          "binary_compare",
          seq(
            field("left", $.expression),
            field("operator", choice("<", "<=", ">=", ">", "==", "!=", "in")),
            field("right", $.expression)
          )
        ),
        prec.left(
          "binary_plus",
          seq(
            field("left", $.expression),
            field("operator", choice("+", "-")),
            field("right", $.expression)
          )
        ),
        prec.left(
          "binary_multiply",
          seq(
            field("left", $.expression),
            field("operator", choice("*", "/", "%")),
            field("right", $.expression)
          )
        ),
        prec.left(
          "logical_and",
          seq(
            field("left", $.expression),
            field("operator", "&&"),
            field("right", $.expression)
          )
        ),
        prec.left(
          "logical_or",
          seq(
            field("left", $.expression),
            field("operator", "||"),
            field("right", $.expression)
          )
        )
      );
    },

    number_literal: ($) => {
      // INT_LIT        ::= -? DIGIT+ | -? 0x HEXDIGIT+
      // UINT_LIT       ::= INT_LIT [uU]
      // FLOAT_LIT      ::= -? DIGIT* . DIGIT+ EXPONENT? | -? DIGIT+ EXPONENT
      // DIGIT          ::= [0-9]
      // HEXDIGIT       ::= [0-9abcdefABCDEF]
      // EXPONENT       ::= [eE] [+-]? DIGIT+
      //
      // see: https://github.com/tree-sitter/tree-sitter-c/blob/master/grammar.js

      const hex_literal = seq(
        "0x",
        /[0-9abcdefABCDEF]+/,
        optional(choice("u", "U"))
      );

      const exponent_part = seq(
        choice("e", "E"),
        optional(choice("+", "-")),
        /[0-9]+/
      );
      const float_literal = seq(
        choice(
          seq(/[0-9]+/, ".", optional(/[0-9]+/), optional(exponent_part)),
          seq(".", /[0-9]+/, optional(exponent_part)),
          seq(/[0-9]+/, exponent_part),
          seq(/[0-9]+/, choice("u", "U")),
          seq(/[0-9]+/)
        )
      );

      return choice(hex_literal, float_literal);
    },
    _reserved_identifier: ($) =>
      choice(
        "in",
        "as",
        "break",
        "const",
        "continue",
        "else",
        "for",
        "function",
        "if",
        "import",
        "let",
        "loop",
        "package",
        "namespace",
        "return",
        "var",
        "void",
        "while"
      ),
  },
});
