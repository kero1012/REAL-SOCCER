"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.afk = void 0;
const chooser_1 = require("./chooser");
const __1 = require("..");
const message_1 = require("./message");
const __2 = require("..");
let j = 0;
exports.afk = {
    onTick: () => {
        if (!chooser_1.duringDraft && !process.env.DEBUG) {
            j += 6;
        }
        if (j > 60) {
            j = 0;
            __1.players
                .filter((p) => p.team == 1 || p.team == 2)
                .forEach((p) => {
                p.afkCounter += 1;
                if (p.afkCounter == 14) {
                    (0, message_1.sendMessage)("Move! You will be AFK in 5 seconds...", p);
                }
                else if (p.afkCounter > 19) {
                    p.afkCounter = 0;
                    __1.room.setPlayerTeam(p.id, 0);
                    p.afk = true;
                }
            });
        }
    },
    onActivity: (p) => {
        (0, __2.toAug)(p).afkCounter = 0;
    },
};
