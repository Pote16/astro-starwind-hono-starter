import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { z } from "astro/zod";

/**
 * Build-Verzeichnis aus `--dist`; ohne Angabe gilt der Standard. Der Deploy
 * prüft dist.new, während Nginx weiterhin dist ausliefert – ein leeres oder
 * fehlendes Argument darf deshalb nie stillschweigend auf dist zurückfallen.
 */
export function buildVerzeichnisAusArgumenten(
  standard: URL,
  argumente: string[] = process.argv.slice(2),
): URL {
  const { values } = parseArgs({
    args: argumente,
    options: { dist: { type: "string" } },
    strict: false,
    allowPositionals: true,
  });
  const { dist } = z.object({ dist: z.string().trim().min(1).optional() }).parse(values);
  return dist ? pathToFileURL(`${resolve(dist)}${sep}`) : standard;
}
