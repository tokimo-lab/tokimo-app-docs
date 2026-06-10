export interface SymbolCategory {
  type: string;
  label: string;
  children: Array<{ latex: string }>;
}

export interface PresetFormula {
  label: string;
  latex: string;
}

export const SYMBOL_LIST: SymbolCategory[] = [
  {
    type: "operators",
    label: "docs.symbolMath",
    children: [
      { latex: "\\cdot" },
      { latex: "\\pm" },
      { latex: "\\mp" },
      { latex: "+" },
      { latex: "-" },
      { latex: "\\times" },
      { latex: "\\div" },
      { latex: "<" },
      { latex: ">" },
      { latex: "=" },
      { latex: "\\neq" },
      { latex: "\\leqq" },
      { latex: "\\geqq" },
      { latex: "\\leq" },
      { latex: "\\geq" },
      { latex: "\\propto" },
      { latex: "\\sim" },
      { latex: "\\equiv" },
      { latex: "\\dagger" },
      { latex: "\\ddagger" },
      { latex: "\\ell" },
      { latex: "\\#" },
      { latex: "\\$" },
      { latex: "\\&" },
      { latex: "\\%" },
      { latex: "\\langle\\rangle" },
      { latex: "()" },
      { latex: "[]" },
      { latex: "\\{\\}" },
      { latex: "||" },
      { latex: "\\|" },
      { latex: "\\exists" },
      { latex: "\\in" },
      { latex: "\\subset" },
      { latex: "\\supset" },
      { latex: "\\cup" },
      { latex: "\\cap" },
      { latex: "\\infty" },
      { latex: "\\partial" },
      { latex: "\\nabla" },
      { latex: "\\aleph" },
      { latex: "\\wp" },
      { latex: "\\therefore" },
      { latex: "\\mid" },
      { latex: "\\sum" },
      { latex: "\\prod" },
      { latex: "\\bigoplus" },
      { latex: "\\bigodot" },
      { latex: "\\int" },
      { latex: "\\oint" },
      { latex: "\\oplus" },
      { latex: "\\odot" },
      { latex: "\\perp" },
      { latex: "\\angle" },
      { latex: "\\triangle" },
      { latex: "\\Box" },
      { latex: "\\rightarrow" },
      { latex: "\\to" },
      { latex: "\\leftarrow" },
      { latex: "\\gets" },
      { latex: "\\circ" },
      { latex: "\\bigcirc" },
      { latex: "\\bullet" },
      { latex: "\\star" },
      { latex: "\\diamond" },
      { latex: "\\ast" },
      { latex: "," },
      { latex: "." },
      { latex: ";" },
      { latex: "!" },
    ],
  },
  {
    type: "group",
    label: "docs.symbolGroup",
    children: [
      { latex: "\\frac{a}{b}" },
      { latex: "\\frac{dx}{dx}" },
      { latex: "\\frac{\\partial a}{\\partial b}" },
      { latex: "\\sqrt{x}" },
      { latex: "\\sqrt[n]{x}" },
      { latex: "x^{n}" },
      { latex: "x_{n}" },
      { latex: "x_a^b" },
      { latex: "\\int_{a}^{b}" },
      { latex: "\\oint_a^b" },
      { latex: "\\lim_{a \\rightarrow b}" },
      { latex: "\\prod_a^b" },
      { latex: "\\sum_a^b" },
      { latex: "\\left(\\begin{array}a \\\\ b\\end{array}\\right)" },
      {
        latex: "\\begin{bmatrix}a & b \\\\ c & d \\end{bmatrix}",
      },
      {
        latex: "\\begin{cases}a & x = 0 \\\\ b & x > 0\\end{cases}",
      },
      { latex: "\\hat{a}" },
      { latex: "\\breve{a}" },
      { latex: "\\acute{a}" },
      { latex: "\\grave{a}" },
      { latex: "\\tilde{a}" },
      { latex: "\\bar{a}" },
      { latex: "\\vec{a}" },
      { latex: "\\underline{a}" },
      { latex: "\\overline{a}" },
      { latex: "\\widehat{ab}" },
      { latex: "\\overleftarrow{ab}" },
      { latex: "\\overrightarrow{ab}" },
    ],
  },
  {
    type: "verbatim",
    label: "docs.symbolFunction",
    children: [
      { latex: "\\log" },
      { latex: "\\ln" },
      { latex: "\\exp" },
      { latex: "\\mod" },
      { latex: "\\lim" },
      { latex: "\\sin" },
      { latex: "\\cos" },
      { latex: "\\tan" },
      { latex: "\\csc" },
      { latex: "\\sec" },
      { latex: "\\cot" },
      { latex: "\\sinh" },
      { latex: "\\cosh" },
      { latex: "\\tanh" },
      { latex: "\\csch" },
      { latex: "\\sech" },
      { latex: "\\coth" },
      { latex: "\\arcsin" },
      { latex: "\\arccos" },
      { latex: "\\arctan" },
      { latex: "\\arccsc" },
      { latex: "\\arcsec" },
      { latex: "\\arccot" },
    ],
  },
  {
    type: "greek",
    label: "docs.symbolGreek",
    children: [
      { latex: "\\alpha" },
      { latex: "\\beta" },
      { latex: "\\gamma" },
      { latex: "\\delta" },
      { latex: "\\varepsilon" },
      { latex: "\\zeta" },
      { latex: "\\eta" },
      { latex: "\\vartheta" },
      { latex: "\\iota" },
      { latex: "\\kappa" },
      { latex: "\\lambda" },
      { latex: "\\mu" },
      { latex: "\\nu" },
      { latex: "\\xi" },
      { latex: "\\omicron" },
      { latex: "\\pi" },
      { latex: "\\rho" },
      { latex: "\\sigma" },
      { latex: "\\tau" },
      { latex: "\\upsilon" },
      { latex: "\\varphi" },
      { latex: "\\chi" },
      { latex: "\\psi" },
      { latex: "\\omega" },
      { latex: "\\epsilon" },
      { latex: "\\theta" },
      { latex: "\\phi" },
      { latex: "\\varsigma" },
      { latex: "\\Alpha" },
      { latex: "\\Beta" },
      { latex: "\\Gamma" },
      { latex: "\\Delta" },
      { latex: "\\Epsilon" },
      { latex: "\\Zeta" },
      { latex: "\\Eta" },
      { latex: "\\Theta" },
      { latex: "\\Iota" },
      { latex: "\\Kappa" },
      { latex: "\\Lambda" },
      { latex: "\\Mu" },
      { latex: "\\Nu" },
      { latex: "\\Xi" },
      { latex: "\\Omicron" },
      { latex: "\\Pi" },
      { latex: "\\Rho" },
      { latex: "\\Sigma" },
      { latex: "\\Tau" },
      { latex: "\\Upsilon" },
      { latex: "\\Phi" },
      { latex: "\\Chi" },
      { latex: "\\Psi" },
      { latex: "\\Omega" },
    ],
  },
];

export const FORMULA_LIST: PresetFormula[] = [
  // I. 极限与连续 (Limits & Continuity)
  {
    label: "docs.formulaSqueeze",
    latex: `g(x) \\leq f(x) \\leq h(x),\\; \\lim_{x \\to a} g(x) = \\lim_{x \\to a} h(x) = L \\implies \\lim_{x \\to a} f(x) = L`,
  },
  {
    label: "docs.formulaLimitSinx",
    latex: `\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1`,
  },
  {
    label: "docs.formulaLimitE",
    latex: `\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^{n} = e`,
  },
  {
    label: "docs.formulaLHopital",
    latex: `\\lim_{x \\to a} \\frac{f(x)}{g(x)} = \\lim_{x \\to a} \\frac{f'(x)}{g'(x)}`,
  },

  // II. 导数与微分 (Derivatives & Differentials)
  {
    label: "docs.formulaChainRule",
    latex: `\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}`,
  },
  {
    label: "docs.formulaProductRule",
    latex: `(uv)' = u'v + uv'`,
  },
  {
    label: "docs.formulaLeibniz",
    latex: `(uv)^{(n)} = \\sum_{k=0}^{n} \\binom{n}{k} u^{(k)} v^{(n-k)}`,
  },
  {
    label: "docs.formulaImplicitDiff",
    latex: `\\frac{dy}{dx} = -\\frac{F_x}{F_y} = -\\frac{\\partial F / \\partial x}{\\partial F / \\partial y}`,
  },

  // III. 积分 (Integration)
  {
    label: "docs.formulaIntByParts",
    latex: `\\int u \\, dv = uv - \\int v \\, du`,
  },
  {
    label: "docs.formulaFTC",
    latex: `\\int_{a}^{b} f(x) \\, dx = F(b) - F(a), \\quad F'(x) = f(x)`,
  },
  {
    label: "docs.formulaWallis",
    latex: `\\int_{0}^{\\frac{\\pi}{2}} \\sin^{n} x \\, dx = \\int_{0}^{\\frac{\\pi}{2}} \\cos^{n} x \\, dx = \\frac{(n-1)!!}{n!!} \\cdot \\begin{cases} \\frac{\\pi}{2} & n \\text{ even} \\\\ 1 & n \\text{ odd} \\end{cases}`,
  },
  {
    label: "docs.formulaGaussianInt",
    latex: `\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}`,
  },

  // IV. 级数 (Series)
  {
    label: "docs.formulaGeometricSeries",
    latex: `\\sum_{n=0}^{\\infty} r^{n} = \\frac{1}{1-r}, \\quad |r| < 1`,
  },
  {
    label: "docs.formulaTaylorExp",
    latex: `e^{x} = \\sum_{n=0}^{\\infty} \\frac{x^{n}}{n!}, \\quad x \\in \\mathbb{R}`,
  },
  {
    label: "docs.formulaTaylorSin",
    latex: `\\sin x = \\sum_{n=0}^{\\infty} \\frac{(-1)^{n}}{(2n+1)!} x^{2n+1}`,
  },
  {
    label: "docs.formulaTaylorCos",
    latex: `\\cos x = \\sum_{n=0}^{\\infty} \\frac{(-1)^{n}}{(2n)!} x^{2n}`,
  },
  {
    label: "docs.formulaTaylorLn",
    latex: `\\ln(1+x) = \\sum_{n=1}^{\\infty} \\frac{(-1)^{n+1}}{n} x^{n}, \\quad -1 < x \\leq 1`,
  },
  {
    label: "docs.formulaConvergenceRadius",
    latex: `R = \\frac{1}{\\displaystyle\\limsup_{n \\to \\infty} \\sqrt[n]{|a_n|}}`,
  },

  // V. 多元微积分 (Multivariable Calculus)
  {
    label: "docs.formulaTotalDiff",
    latex: `dz = \\frac{\\partial z}{\\partial x} dx + \\frac{\\partial z}{\\partial y} dy`,
  },
  {
    label: "docs.formulaGreenThm",
    latex: `\\oint_{\\partial D} P \\, dx + Q \\, dy = \\iint_{D} \\left( \\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} \\right) dx \\, dy`,
  },
  {
    label: "docs.formulaStokesThm",
    latex: `\\oint_{\\partial S} \\mathbf{F} \\cdot d\\mathbf{r} = \\iint_{S} (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S}`,
  },
  {
    label: "docs.formulaDivergenceThm",
    latex: `\\oiint_{\\partial V} \\mathbf{F} \\cdot d\\mathbf{S} = \\iiint_{V} \\nabla \\cdot \\mathbf{F} \\, dV`,
  },

  // VI. 微分方程 (Differential Equations)
  {
    label: "docs.formulaSeparableODE",
    latex: `\\frac{dy}{dx} = f(x) g(y) \\implies \\int \\frac{dy}{g(y)} = \\int f(x) \\, dx + C`,
  },
  {
    label: "docs.formulaFirstOrderLinear",
    latex: `y = e^{-\\int P(x)dx} \\left( \\int Q(x) e^{\\int P(x)dx} dx + C \\right)`,
  },
  {
    label: "docs.formulaSecondOrderConst",
    latex: `y'' + py' + qy = 0 \\implies y = C_1 e^{r_1 x} + C_2 e^{r_2 x}`,
  },

  // VII. 线性代数 (Linear Algebra)
  {
    label: "docs.formulaCramer",
    latex: `x_j = \\frac{\\det(A_j)}{\\det(A)}, \\quad j = 1, 2, \\ldots, n`,
  },
  {
    label: "docs.formulaEigenvalue",
    latex: `A \\mathbf{x} = \\lambda \\mathbf{x} \\iff \\det(A - \\lambda I) = 0`,
  },
  {
    label: "docs.formulaDetExpansion",
    latex: `\\det(A) = \\sum_{j=1}^{n} a_{ij} \\, (-1)^{i+j} M_{ij}`,
  },

  // VIII. 概率统计 (Probability & Statistics)
  {
    label: "docs.formulaBayes",
    latex: `P(A_i | B) = \\frac{P(B | A_i) P(A_i)}{\\displaystyle\\sum_{j=1}^{n} P(B | A_j) P(A_j)}`,
  },
  {
    label: "docs.formulaNormalDist",
    latex: `f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} \\, e^{-\\frac{(x - \\mu)^2}{2\\sigma^2}}`,
  },
  {
    label: "docs.formulaExpectedValue",
    latex: `E(X) = \\sum_{i} x_i \\, P(X = x_i)`,
  },

  // IX. 经典公式 (Classical Formulas)
  {
    label: "docs.formulaEulerIdentity",
    latex: `e^{i\\pi} + 1 = 0`,
  },
  {
    label: "docs.formulaQuadratic",
    latex: `x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`,
  },
  {
    label: "docs.formulaCauchySchwarz",
    latex: `\\left( \\sum_{i=1}^{n} a_i b_i \\right)^{2} \\leq \\left( \\sum_{i=1}^{n} a_i^2 \\right) \\left( \\sum_{i=1}^{n} b_i^2 \\right)`,
  },
  {
    label: "docs.formulaStirling",
    latex: `n! \\sim \\sqrt{2\\pi n} \\left( \\frac{n}{e} \\right)^{n}`,
  },
];
