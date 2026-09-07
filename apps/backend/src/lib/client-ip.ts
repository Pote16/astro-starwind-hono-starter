import { isIP } from "node:net";

import { z } from "zod";

const ipSchema = z.string().refine((ip) => isIP(ip) !== 0 && !ip.includes("%"));
const forwardedForSchema = z
  .string()
  .min(1)
  .max(2048)
  .transform((header) => header.split(",").map((ip) => ip.trim()))
  .pipe(z.array(ipSchema).min(1).max(64));
const proxyHopsSchema = z.number().int().min(1).max(5);

export const UNKNOWN_CLIENT_KEY = "unknown-client";

export function clientIpKey(header: unknown, trustedProxyHops: unknown = 1): string {
  const parsed = forwardedForSchema.safeParse(header);
  const hops = proxyHopsSchema.safeParse(trustedProxyHops);
  if (!parsed.success || !hops.success || parsed.data.length < hops.data) return UNKNOWN_CLIENT_KEY;

  // Nginx hängt den direkten Peer rechts an. Vom Client gesetzte linke Werte
  // dürfen den Schlüssel nicht verändern. Das Backend ist nur lokal erreichbar.
  const ip = parsed.data[parsed.data.length - hops.data];
  if (isIP(ip) === 4) return ip;
  // Gleiche IPv6-Adressen dürfen nicht über unterschiedliche Schreibweisen
  // mehrere Rate-Limit-Buckets bekommen.
  return new URL(`http://[${ip}]`).hostname.slice(1, -1);
}
