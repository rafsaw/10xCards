/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular dependencies make modules hard to reason about and to test in isolation. Break the cycle by extracting the shared piece or inverting one of the dependencies.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment:
        "Unreachable module — nothing imports it and it imports nothing. Either wire it up or delete it.",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$", // dotfiles like .eslintrc
          "\\.d\\.ts$", // type declarations (env.d.ts)
          "(^|/)tsconfig\\.json$",
          "(^|/)(astro|vitest|playwright|wrangler)\\.config\\.[^/]+$",
        ],
      },
      to: {},
    },
    {
      name: "api-not-imported-by-client",
      severity: "error",
      comment:
        "API route handlers (src/pages/api/**) are server endpoints. They must not be imported by other modules — call them over HTTP. Share logic by extracting it into src/lib instead.",
      from: { pathNot: "^src/pages/api/" },
      to: { path: "^src/pages/api/" },
    },
    {
      name: "api-no-react-components",
      severity: "error",
      comment:
        "API routes run on the server and must not pull in React UI components. Keep server logic in src/lib.",
      from: { path: "^src/pages/api/" },
      to: { path: "^src/components/.+\\.(tsx|jsx)$" },
    },
    {
      name: "no-server-lib-in-client",
      severity: "error",
      comment:
        "Server-only helpers (Supabase admin, OpenRouter, retention, observability) carry secrets/Node APIs and must never be bundled into client React components. Access them through API routes.",
      from: { path: "^src/components/.+\\.(tsx|jsx)$" },
      to: {
        path: "^src/lib/(supabase|openrouter|account-retention|observability)\\.ts$",
      },
    },
    {
      name: "not-to-test",
      severity: "error",
      comment: "Production code must not depend on test files.",
      from: { pathNot: "\\.(test|spec|integration\\.test)\\.[^.]+$" },
      to: { path: "\\.(test|spec|integration\\.test)\\.[^.]+$" },
    },
    {
      name: "no-dev-dep-in-src",
      severity: "error",
      comment:
        "A devDependency leaked into shipped source. Move it to dependencies or keep its use in tests/config only.",
      from: { path: "^src/", pathNot: "\\.(test|spec|integration\\.test)\\.[^.]+$" },
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: ["node_modules/@types/"],
      },
    },
    {
      name: "no-deprecated-core",
      severity: "warn",
      comment: "Deprecated Node core module — find a maintained replacement.",
      from: {},
      to: { dependencyTypes: ["core"], path: ["^(punycode|domain|sys|querystring)$"] },
    },
    {
      name: "no-non-package-json",
      severity: "error",
      comment: "Depends on an npm package that isn't declared in package.json.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
  ],

  options: {
    doNotFollow: { path: ["node_modules"] },

    exclude: {
      path: ["\\.astro/", "^dist/", "^public/", "^supabase/", "^context/", "^\\.claude/"],
    },

    tsConfig: { fileName: "tsconfig.json" },

    tsPreCompilationDeps: true,

    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },

    reporterOptions: {
      dot: { collapsePattern: "node_modules/(@[^/]+/[^/]+|[^/]+)" },
      archi: {
        collapsePattern:
          "^(src/(pages/api|pages|components|lib|layouts))",
      },
    },
  },
};
