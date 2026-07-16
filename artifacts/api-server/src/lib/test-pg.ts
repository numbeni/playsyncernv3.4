import { spawn, execSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PACKAGE_DIR = path.resolve(__dirname, "..", "..", "..", "..", "lib", "db");

export interface TestPg {
  databaseUrl: string;
  stop: () => Promise<void>;
}

export interface TestServer {
  baseUrl: string;
  stop: () => Promise<void>;
}

export async function startTestPg(options?: {
  skipMigrations?: boolean;
}): Promise<TestPg> {
  const port = await getFreePort();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "playsyncer-test-pg-"));
  const pgdata = path.join(tmpDir, "pgdata");
  const socketDir = path.join(tmpDir, "sockets");
  const logFile = path.join(tmpDir, "pg.log");

  fs.mkdirSync(socketDir, { recursive: true });

  execSync(`initdb -D "${pgdata}" -U postgres --no-locale --encoding=UTF8`, {
    stdio: "ignore",
  });

  await startPostgres(pgdata, socketDir, String(port), logFile);

  execSync(
    `createdb -h "${socketDir}" -p ${port} -U postgres playsyncer_test`,
    { stdio: "ignore" },
  );

  const databaseUrl = `postgresql://postgres@localhost/playsyncer_test?host=${socketDir}&port=${port}`;

  if (!options?.skipMigrations) {
    runMigrations(databaseUrl);
  }

  return {
    databaseUrl,
    stop: async () => {
      try {
        execSync(`pg_ctl -D "${pgdata}" stop -m fast`, { stdio: "ignore" });
      } catch {
        // Server may already be stopped; ignore.
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

export async function startApiServer(
  databaseUrl: string,
  serverDir: string,
): Promise<TestServer> {
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}/api`;
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: String(port),
    BASE_PATH: "/api-server",
    NODE_ENV: "test",
  };

  const child = spawn("node", [path.join(serverDir, "index.mjs")], {
    env,
    stdio: "ignore",
  });

  await waitForServer(baseUrl);

  return {
    baseUrl,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.on("exit", resolve));
    },
  };
}

async function waitForServer(baseUrl: string): Promise<void> {
  const healthUrl = `${baseUrl}/healthz`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl);
      if (res.status === 200) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API server did not become ready at ${healthUrl}`);
}

function runMigrations(databaseUrl: string): void {
  const prevDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  try {
    execFileSync(
      path.join(DB_PACKAGE_DIR, "node_modules", ".bin", "drizzle-kit"),
      ["migrate", "--config", "./drizzle.config.ts"],
      {
        cwd: DB_PACKAGE_DIR,
        stdio: "pipe",
      },
    );
  } catch (err) {
    const error = err as { stderr?: Buffer; stdout?: Buffer };
    const stderr = error.stderr?.toString();
    const stdout = error.stdout?.toString();
    if (stderr) console.error(stderr);
    if (stdout) console.error(stdout);
    throw new Error(
      `Failed to run migrations against disposable database: ${err}`,
    );
  } finally {
    process.env.DATABASE_URL = prevDatabaseUrl ?? undefined;
  }
}

function startPostgres(
  pgdata: string,
  socketDir: string,
  port: string,
  logFile: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "pg_ctl",
      [
        "-D",
        pgdata,
        "-l",
        logFile,
        "start",
        "-o",
        `-p ${port} -k ${socketDir} -h 127.0.0.1`,
        "-w",
      ],
      { stdio: "ignore" },
    );
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_ctl start failed with exit code ${code}`));
      }
    });
  });
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}
