import session from "express-session";
import { prisma } from "./prisma.js";

export class PrismaAdminSessionStore extends session.Store {
  get(sid: string, callback: (err?: unknown, session?: session.SessionData | null) => void) {
    prisma.adminSession.findUnique({ where: { id: sid } })
      .then((row) => {
        if (!row || row.expiresAt <= new Date()) return callback(null, null);
        callback(null, row.data as unknown as session.SessionData);
      })
      .catch((error) => callback(error));
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void) {
    const expiresAt = sess.cookie.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000);
    prisma.adminSession.upsert({
      where: { id: sid },
      update: { data: sess as unknown as object, expiresAt },
      create: { id: sid, data: sess as unknown as object, expiresAt }
    })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (err?: unknown) => void) {
    prisma.adminSession.deleteMany({ where: { id: sid } })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
}
