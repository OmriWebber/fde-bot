import prismaClientPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

type PrismaClientConstructor = new (options?: { adapter?: PrismaPg }) => any;

const { PrismaClient } = prismaClientPackage as unknown as {
  PrismaClient: PrismaClientConstructor;
};

type PrismaClientInstance = InstanceType<PrismaClientConstructor>;

function makeClient(): PrismaClientInstance {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientInstance;
};
export const prisma: PrismaClientInstance =
  globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
