# Pro Blocks

Search current Pro metadata before choosing a block. Do not invent block IDs, slugs, install commands, or plan availability.

Starwind Pro blocks are native Astro components copied into the project. They are designed to be owned and edited locally, with typed props/data, Tailwind CSS v4, dark mode, and container-query-friendly layouts.

## Search Sources

Use the best available source:

1. MCP `search_starwind_pro_blocks`.
2. Block pages on `https://pro.starwind.dev/components/`.
3. CLI or registry metadata when current and accessible.
4. Pro docs for setup, theming, dark mode, animation, and troubleshooting.

The MCP returns block IDs, categories, plan type, preview URLs, and install commands. Treat that as the source of truth when available. Use `starwind_add` when you need a package-manager-specific command or an init-plus-add command.

## Search Strategy

Search by what the user needs, then narrow:

- Intent: "SaaS hero", "pricing with toggle", "login form", "FAQ", "footer", "testimonial".
- Category: `hero`, `pricing`, `authentication`, `navigation`, `feature`, `faq`, `footer`, `contact`, `form`, `theme-switcher`.
- Plan: `free` when the user asks for no-license, starter, demo, or free blocks; `pro` only when paid access is expected.

If a specific query returns no results, relax it to the category or a simpler term.

## CLI Search

If the CLI supports search in the current environment, keep searches explicit:

```bash
npx starwind@latest search hero --json
npx starwind@latest search pricing --plan free --category pricing --limit 10 --json
npx starwind@latest search authentication --plan pro --json
```

Verify available flags against current CLI docs or MCP output before relying on them.

## Install Commands

Use the exact install command returned by current metadata:

```bash
npx starwind@latest add @starwind-pro/hero-01
```

Returned commands can include Starwind UI dependencies:

```bash
npx starwind@latest add @starwind-pro/hero-03 button aspect-ratio --yes
```

Rules:

- Do not simplify returned commands by removing dependencies.
- Do not add or remove `--yes` unless the MCP/CLI result or user intent requires it.
- If the project is not initialized for Pro, initialize with `--pro` first.
- If a premium block fails because license access is missing, state that clearly and search for a free alternative.
- After installation, read the added block and dependency files before wiring them into a page.
- Fix demo imports only when they do not match the project's actual aliases.

## Adapting Blocks

After install:

- Wire the block into the requested route or layout.
- Replace placeholder copy, links, images, and data.
- Preserve Astro frontmatter, `class` attributes, Starwind component imports, and TypeScript prop interfaces.
- Keep responsive, container-query, dark-mode, and animation behavior unless the user asks to change it.
- Prefer theme variables and local props/classes over broad utility-class rewrites.
- Replace demo-only imagery or links that would make the page look unfinished.

## Related Setup

- Use `npx starwind@latest init --pro` for new or uninitialized projects.
- Use `npx starwind@latest setup` for existing Starwind UI projects.
- Theme changes belong in `src/styles/starwind.css` unless the user wants block-only customization.
- Dark mode depends on the `.dark` class strategy used by Starwind UI.
- For scroll-entry animation, use the documented `motion-on-scroll` setup rather than hand-rolling the behavior.
