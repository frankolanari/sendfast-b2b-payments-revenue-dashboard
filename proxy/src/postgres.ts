/** Connection settings and value formats shared by the Node and Workers entry points. */
import pg from "pg";

export type Env = Record<string, string | undefined>;

export function databaseConfig(env: Env): pg.ClientConfig {
  const need = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Set ${name} (see .env.example).`);
    return value;
  };
  return {
    host: need("DATA_DB_HOST"),
    port: Number(need("DATA_DB_HOST_PORT")),
    database: need("DATA_DB_NAME"),
    user: need("BI_READER_USER"),
    password: need("BI_READER_PASSWORD"),
    ssl: env.DATA_DB_SSLMODE === "require",
    options:
      "-c timezone=UTC -c default_transaction_read_only=on -c statement_timeout=30000",
  };
}

// Values in their JSON form: numbers as numbers, dates as UTC instants (D15).
const asNumber = (v: string) => Number(v);
const asInstant = (v: string) =>
  new Date(v.length === 10 ? `${v}T00:00:00Z` : v)
    .toISOString()
    .replace(".000Z", "Z");

export function setTypeParsers(): void {
  pg.types.setTypeParser(20, asNumber); // bigint
  pg.types.setTypeParser(1700, asNumber); // numeric
  pg.types.setTypeParser(1082, asInstant); // date
  pg.types.setTypeParser(1184, asInstant); // timestamptz
  pg.types.setTypeParser(1114, (v) => asInstant(`${v.replace(" ", "T")}Z`)); // timestamp (UTC)
}
