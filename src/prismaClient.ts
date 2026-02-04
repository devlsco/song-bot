import { PrismaClient } from "@prisma/client";
import logger from "./utils/logger";

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? [
          { emit: "event", level: "query" },
          { emit: "event", level: "info" },
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ]
      : [{ emit: "event", level: "error" }],
});

prisma.$on("query", (e) => {
  logger.debug(`Query: ${e.query} Params: ${e.params} Duration: ${e.duration}ms`);
});

prisma.$on("info", (e) => {
  logger.info(`Info: ${e.message}`);
});

prisma.$on("warn", (e) => {
  logger.warn(`Warn: ${e.message}`);
});

prisma.$on("error", (e) => {
  logger.error(`Error: ${e.message}`);
});

export default prisma;
