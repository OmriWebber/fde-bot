import prismaClientPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

type PrismaClientConstructor = new (options?: { adapter?: PrismaPg }) => any;

const { PrismaClient } = prismaClientPackage as unknown as {
  PrismaClient: PrismaClientConstructor;
};

type PrismaClientInstance = InstanceType<PrismaClientConstructor>;

function getDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;

  try {
    const url = new URL(raw);
    const sslMode = url.searchParams.get("sslmode");
    const useLibpqCompat = url.searchParams.get("uselibpqcompat") === "true";

    if (
      !useLibpqCompat &&
      (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca")
    ) {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    return raw;
  }

  return raw;
}

function makeClient(): PrismaClientInstance {
  const pool = new pg.Pool({ connectionString: getDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientInstance;
};
export const prisma: PrismaClientInstance =
  globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
