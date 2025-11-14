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
exports.announceCards = exports.checkFoul = exports.isPenalty = void 0;
const index_1 = require("../index");
const settings_1 = require("./settings");
const message_1 = require("./message");
const isPenalty = (victim) => {
    const positiveX = Math.abs(victim.fouledAt.x);
    const isYInRange = Math.abs(victim.fouledAt.y) <= settings_1.box.y;
    const boxSide = victim.team == 1 ? 1 : -1;
    const isInBox = positiveX >= settings_1.box.x &&
        positiveX <= settings_1.mapBounds.x &&
        Math.sign(victim.fouledAt.x) === boxSide;
    const result = isYInRange && isInBox;
    return result;
};
exports.isPenalty = isPenalty;
const checkFoul = () => __awaiter(void 0, void 0, void 0, function* () {
    index_1.room
        .getPlayerList()
        .filter((p) => p.team != 0 && (0, index_1.toAug)(p).sliding)
        .forEach((p) => {
        const ballPos = index_1.room.getBallPosition();
        const distToBall = Math.sqrt((p.position.x - ballPos.x) ** 2 + (p.position.y - ballPos.y) ** 2);
        if (distToBall < settings_1.defaults.playerRadius + settings_1.defaults.ballRadius + 0.1) {
            (0, index_1.toAug)(p).sliding = false;
            return;
        }
        const enemyTeam = p.team == 1 ? 2 : 1;
        index_1.room
            .getPlayerList()
            .filter((pp) => pp.team == enemyTeam)
            .forEach((enemy) => {
            const dist = Math.sqrt((p.position.x - enemy.position.x) ** 2 +
                (p.position.y - enemy.position.y) ** 2);
            if (dist < settings_1.defaults.playerRadius * 2 + 0.1) {
                handleSlide((0, index_1.toAug)(p), (0, index_1.toAug)(enemy));
            }
        });
    });
});
exports.checkFoul = checkFoul;
const handleSlide = (slider, victim) => {
    if (victim.slowdown) {
        return;
    }
    slider.sliding = false;
    const sliderProps = index_1.room.getPlayerDiscProperties(slider.id);
    const victimProps = index_1.room.getPlayerDiscProperties(victim.id);
    const ballPos = index_1.room.getBallPosition();
    const ballDist = Math.sqrt((slider.position.x - ballPos.x) ** 2 + (slider.position.y - ballPos.y) ** 2);
    let cardsFactor = 0.7;
    if (ballDist > 300) {
        cardsFactor += 1; // flagrant foul
        (0, message_1.sendMessage)(`Flagrant foul by ${slider.name}.`);
    }
    victim.fouledAt = { x: victimProps.x, y: victimProps.y };
    if ((0, exports.isPenalty)(victim)) {
        cardsFactor += 0.3;
    }
    const power = Math.max(Math.sqrt(sliderProps.xspeed ** 2 + sliderProps.yspeed ** 2) * 0.6, 0.7);
    const slowdown = power > 2.9 ? 0.045 * power : 0.032 * power;
    const av = power > 2.7 ? "❌" : "🩹";
    index_1.room.setPlayerAvatar(victim.id, av);
    victim.slowdown = slowdown;
    victim.slowdownUntil =
        new Date().getTime() +
            1000 * (5 ** power * (0.5 + 0.5 * Math.random() * Math.random()));
    victim.canCallFoulUntil = new Date().getTime() + 4000;
    (0, message_1.sendMessage)("You have been fouled. You can call foul by holding X in the next 4 seconds.", victim);
    slider.foulsMeter += 0.7 * power * cardsFactor * (Math.random() * 0.2 + 0.9);
};
const announceCards = (game) => {
    index_1.players
        .filter((p) => p.team != 0)
        .forEach((p) => {
        if (p.foulsMeter > p.cardsAnnounced) {
            if (p.foulsMeter > 1 && p.foulsMeter < 2) {
                index_1.room.setPlayerAvatar(p.id, "🟨");
                (0, message_1.sendMessage)("🟨 Yellow card for " + p.name);
            }
            else if (p.foulsMeter >= 2) {
                index_1.room.setPlayerAvatar(p.id, "🟥");
                index_1.room.setPlayerTeam(p.id, 0);
                (0, message_1.sendMessage)("🟥 Red card for " + p.name);
            }
            p.cardsAnnounced = p.foulsMeter;
        }
    });
};
exports.announceCards = announceCards;
