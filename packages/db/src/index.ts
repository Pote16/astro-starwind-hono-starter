import { drizzle } from "drizzle-orm/bun-sql";
import { SQL } from "bun";
import * as schema from "./schema.js";

// Verhindert Error beim Build, wenn die Umgebungsvariable noch nicht gesetzt ist
const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5435/starter";

const client = new SQL(connectionString);
export const db = drizzle({ client, schema });

export * from "./schema.js";
