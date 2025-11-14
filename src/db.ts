import { AsyncDatabase as Database } from "promised-sqlite3";
import { game, PlayerAugmented } from "..";

export let db: any;

const createTables = async (db: any) => {
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS "players" (
            "id"	INTEGER PRIMARY KEY AUTOINCREMENT,
            "auth"	TEXT NOT NULL UNIQUE,
            "name"	TEXT,
            "elo"	INTEGER DEFAULT 1200,
            "vip"  TEXT DEFAULT '0',
            "goals" INTEGER DEFAULT 0,
            "assists" INTEGER DEFAULT 0,
            "matches" INTEGER DEFAULT 0
    );`,
  ];

  for (const t of createStatements) {
    await db.run(t);
  }
  
  // Add missing columns to existing database
  try {
    await db.run(`ALTER TABLE players ADD COLUMN goals INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }
  
  try {
    await db.run(`ALTER TABLE players ADD COLUMN assists INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }
  
  try {
    await db.run(`ALTER TABLE players ADD COLUMN matches INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }
};

export const initDb = async () => {
  db = await Database.open("db.sqlite");
  // Uncomment for DB SQL Debug:
  // db.inner.on("trace", (sql: any) => console.log("[TRACE]", sql));
  await createTables(db); // إنشاء الجداول فقط إذا لم تكن موجودة
  return db;
};

interface ReadPlayer {
  elo: number;
  vip: boolean;
}

export const getOrCreatePlayer = async (
  p: { auth: string; name: string },
): Promise<ReadPlayer> => {
  const auth = p.auth;
  const playerInDb = await db.get("SELECT elo, vip FROM players WHERE auth=?", [
    auth,
  ]);

  if (!playerInDb) {
    await db.run("INSERT INTO players(auth, name, elo, vip) VALUES (?, ?, ?, ?)", [
      p.auth,
      p.name,
      1200,
      '0'  // VIP افتراضي 0
    ]);
    return { elo: 1200, vip: false };
  }

const vipBool = playerInDb.vip === 1;

  return { elo: playerInDb.elo, vip: !!vipBool };
};

