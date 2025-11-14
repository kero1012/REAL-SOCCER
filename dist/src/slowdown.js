"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySlowdown = void 0;
const index_1 = require("../index");
const applySlowdown = (playerList) => {
    const list = playerList !== null && playerList !== void 0 ? playerList : index_1.room.getPlayerList();
    list
        .filter((p) => p.team != 0)
        .forEach((p) => {
        const pAug = (0, index_1.toAug)(p);
        if (new Date().getTime() > pAug.slowdownUntil) {
            if (pAug.slowdown) {
                pAug.slowdown = 0;
                index_1.room.setPlayerAvatar(p.id, "");
                index_1.room.setPlayerDiscProperties(p.id, { xgravity: 0, ygravity: 0 });
            }
            return;
        }
        const props = index_1.room.getPlayerDiscProperties(p.id);
        if (!props || props.xspeed === undefined || props.yspeed === undefined) {
            return;
        }
        index_1.room.setPlayerDiscProperties(p.id, {
            xgravity: -props.xspeed * pAug.slowdown,
            ygravity: -props.yspeed * pAug.slowdown,
        });
    });
};
exports.applySlowdown = applySlowdown;
