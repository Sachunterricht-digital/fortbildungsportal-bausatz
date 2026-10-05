import { PrismaClient } from "@prisma/client";

// Im Dev-Modus wird das Modul bei jedem Hot-Reload neu ausgewertet. Ohne den
// Umweg über globalThis entstünde dabei jedes Mal ein neuer Client mit eigenem
// Verbindungspool, bis Postgres die Verbindungen verweigert.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
