# Pro Setup

Starwind Pro setup depends on an Astro project and Starwind UI configuration.

## Requirements

- Astro project.
- Node.js 22+.
- Starwind UI configured, or permission to initialize it.
- Starwind Pro license for premium blocks. Free blocks do not require a license.

## New Project

When the user wants Pro from the start, run from the project root:

```bash
npx starwind@latest init --pro
```

This initializes Starwind UI and configures the Pro registry.

For noninteractive setup, prefer the current command returned by the Starwind MCP or CLI. It may include `--defaults --pro`.

## Existing Starwind Project

When Starwind UI already exists, configure Pro with:

```bash
npx starwind@latest setup
npx starwind@latest setup --yes
npx starwind@latest setup --package-manager pnpm
```

The setup command may update registry configuration, create `.env.local`, and update `.gitignore`.

Useful flags:

- `-y, --yes`: skip confirmation prompts.
- `-m, --package-manager`: choose `npm`, `pnpm`, or `yarn`.
- `-p, --pro`: setup Starwind Pro. This is the default for `setup`.

## pnpm Projects

If the project uses pnpm and dependency resolution looks off, recommend this root `.npmrc`:

```text
auto-install-peers=true
node-linker=hoisted
lockfile=true
```

## Manual Registry Setup

Prefer the CLI, but if manual setup is needed, Starwind Pro is configured as a private shadcn registry in `components.json`:

```json
{
  "registries": {
    "@starwind-pro": {
      "url": "https://pro.starwind.dev/r/{name}",
      "headers": {
        "Authorization": "Bearer ${STARWIND_LICENSE_KEY}"
      }
    }
  }
}
```

Then keep the license in `.env.local`:

```bash
STARWIND_LICENSE_KEY=your_starwind_pro_license_key
```

A valid license key is not required for free blocks.

## Secrets

- Do not hardcode `STARWIND_LICENSE_KEY` or other license values in source files.
- Do not ask the user to paste secrets into chat.
- Keep license values in environment files or the user's secret manager.
- If `.env.local` is created, confirm it is ignored by git.
- Never echo the license value in command output, docs, commits, or final messages.

## Troubleshooting

For license errors:

- Confirm `.env.local` is in the project root.
- Confirm the variable name is exactly `STARWIND_LICENSE_KEY`.
- Check for extra spaces around the value.
- Ask the user to verify the key is active; do not inspect or print it.

For install errors:

- Confirm the command is being run from the project root.
- Confirm the project was initialized with `--pro`.
- Run or recommend `npx starwind@latest setup` for existing Starwind UI projects.
- Search for a free alternative if a premium block cannot be installed.

## Handoff

When a setup step cannot be completed:

- Say which prerequisite is missing.
- Say which command should be run next.
- Keep any selected block and install command visible so the user can continue.
