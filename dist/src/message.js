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
exports.playerMessage = exports.sendMessage = void 0;
const index_1 = require("../index");
const utils_1 = require("./utils");
const percentage = (elo) => 1 / (1 + Math.E ** -((elo - 1200) / 100));
const sendMessage = (msg, p) => {
    if (p) {
        index_1.room.sendAnnouncement(`[DM] ${msg}`, p.id, 0xd6cedb, "small", 2);
    }
    else {
        index_1.room.sendAnnouncement(`[Server] ${msg}`, undefined, 0xd6cedb, "small", 0);
    }
};
exports.sendMessage = sendMessage;
const playerMessage = (p, msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (p.afk) {
        (0, exports.sendMessage)(`You are AFK. Write "!back" to come back.`, p);
    }
    const card = p.cardsAnnounced < 1 ? `` : p.cardsAnnounced < 2 ? `🟨 ` : `🟥 `;
    index_1.room.sendAnnouncement(`[${p.elo}] ${card}${p.name}: ${msg}`, undefined, (0, utils_1.blendColorsInt)(0x636363, 0xfff7f2, percentage(p.elo) * 100), "normal", 1);
});
exports.playerMessage = playerMessage;
