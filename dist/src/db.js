"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreatePlayer = exports.initDb = exports.db = void 0;
const promised_sqlite3_1 = require("promised-sqlite3");
const createTables = (db) => __awaiter(void 0, void 0, void 0, function* () {
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
        yield db.run(t);
    }
    // Add missing columns to existing database
    try {
        yield db.run(`ALTER TABLE players ADD COLUMN goals INTEGER DEFAULT 0`);
    }
    catch (e) { /* Column already exists */ }
    try {
        yield db.run(`ALTER TABLE players ADD COLUMN assists INTEGER DEFAULT 0`);
    }
    catch (e) { /* Column already exists */ }
    try {
        yield db.run(`ALTER TABLE players ADD COLUMN matches INTEGER DEFAULT 0`);
    }
    catch (e) { /* Column already exists */ }
});
const initDb = () => __awaiter(void 0, void 0, void 0, function* () {
    exports.db = yield promised_sqlite3_1.AsyncDatabase.open("db.sqlite");
    // Uncomment for DB SQL Debug:
    // db.inner.on("trace", (sql: any) => console.log("[TRACE]", sql));
    yield createTables(exports.db); // إنشاء الجداول فقط إذا لم تكن موجودة
    return exports.db;
});
exports.initDb = initDb;
const getOrCreatePlayer = (p) => __awaiter(void 0, void 0, void 0, function* () {
    const auth = p.auth;
    const playerInDb = yield exports.db.get("SELECT elo, vip FROM players WHERE auth=?", [
        auth,
    ]);
    if (!playerInDb) {
        yield exports.db.run("INSERT INTO players(auth, name, elo, vip) VALUES (?, ?, ?, ?)", [
            p.auth,
            p.name,
            1200,
            '0' // VIP افتراضي 0
        ]);
        return { elo: 1200, vip: false };
    }
    const vipBool = playerInDb.vip === 1;
    return { elo: playerInDb.elo, vip: !!vipBool };
});
exports.getOrCreatePlayer = getOrCreatePlayer;
