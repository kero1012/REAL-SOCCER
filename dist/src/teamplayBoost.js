"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetTeamplayBoost = exports.teamplayBoost = exports.setBallInvMassAndColor = exports.boostToColor = void 0;
const __1 = require("..");
const message_1 = require("./message");
const settings_1 = require("./settings");
const utils_1 = require("./utils");
const boostToCoef = (game) => (1 / (1 + Math.E ** -(game.boostCount * 0.4)) - 0.5) * 2;
const boostToColor = (game, team) => (0, utils_1.blendColorsInt)(0xffffff, team === 1 ? 0xd10000 : 0x0700d1, boostToCoef(game) * 100);
exports.boostToColor = boostToColor;
const setBallInvMassAndColor = (game, team) => {
    __1.room.setDiscProperties(0, {
        color: (0, exports.boostToColor)(game, team),
        invMass: settings_1.defaults.ballInvMass + boostToCoef(game) * 1.45,
    });
};
exports.setBallInvMassAndColor = setBallInvMassAndColor;
const teamplayBoost = (game, p) => {
    var _a;
    // Teamplay boost. Ball is lighter (kicks are stronger)
    // depending on within team pass streak.
    if (!game.lastKick || ((_a = game.lastKick) === null || _a === void 0 ? void 0 : _a.team) === p.team) {
        game.boostCount += 1;
        const team = p.team == 1 ? "Red" : "Blue";
        const teamEmoji = p.team == 1 ? "🔴" : "🔵";
        if (game.boostCount == 5) {
            (0, message_1.sendMessage)(`🔥   ${team} team has set the ball on FIRE.`);
        }
    }
    else {
        game.boostCount = 0;
    }
    game.lastKick = p;
    (0, exports.setBallInvMassAndColor)(game, p.team);
};
exports.teamplayBoost = teamplayBoost;
const resetTeamplayBoost = (game) => {
    game.ballRotation = { x: 0, y: 0, power: 0 };
    game.boostCount = 0;
    (0, exports.setBallInvMassAndColor)(game);
};
exports.resetTeamplayBoost = resetTeamplayBoost;
