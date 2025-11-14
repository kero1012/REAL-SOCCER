"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamSize = exports.powerBarDiscs = exports.offsideDiscs = exports.thirdBallId = exports.secondBallId = exports.colors = exports.defaults = exports.penaltyPoint = exports.box = exports.goals = exports.mapBounds = void 0;
exports.mapBounds = { x: 1150, y: 610 };
exports.goals = { y: 124 };
exports.box = { x: 840, y: 320 };
exports.penaltyPoint = { x: 935, y: 0 };
exports.defaults = {
    invMass: 0.4,
    ballInvMass: 1.235,
    ballRadius: 7.6,
    playerRadius: 14,
    kickingDamping: 0.9649,
};
exports.colors = {
    white: 0xffffff,
    red: 0xe07d6e,
    blue: 0x6e9ee0,
    powerball: 0xf5c28c,
};
exports.secondBallId = 24;
exports.thirdBallId = 25;
exports.offsideDiscs = { red: [26, 27], blue: [28, 29] };
exports.powerBarDiscs = [30, 31, 32, 33, 34]; // Power bar disc IDs
exports.teamSize = 6;
