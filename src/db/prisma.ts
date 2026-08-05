import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { d1Prisma } from "./d1-prisma-shim.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const postgresPrisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = postgresPrisma;

export const prisma = (env.DATABASE_PROVIDER === "d1" ? d1Prisma : postgresPrisma) as unknown as PrismaClient;
