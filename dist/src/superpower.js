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
exports.rotateBall = exports.sprint = exports.checkAllX = void 0;
const index_1 = require("../index");
const message_1 = require("./message");
const out_1 = require("./out");
const settings_1 = require("./settings");
const utils_1 = require("./utils");
const foul_1 = require("./foul");
const checkAllX = (game) => {
    index_1.players
        .filter((p) => p.team != 0)
        .forEach((pp) => {
        const props = index_1.room.getPlayerDiscProperties(pp.id);
        if (!props) {
            return;
        }
        // When X is PRESSED
        if (props.damping == settings_1.defaults.kickingDamping) {
            pp.activation += 6;
            if (new Date().getTime() < pp.canCallFoulUntil &&
                pp.activation > 20 &&
                Math.abs(pp.fouledAt.x) < settings_1.mapBounds.x) {
                if (!game.inPlay) {
                    return;
                }
                (0, message_1.sendMessage)(`${pp.name} has called foul.`);
                if ((0, foul_1.isPenalty)(pp)) {
                    (0, out_1.penalty)(game, pp.team, Object.assign({}, pp.fouledAt));
                    pp.activation = 0;
                    pp.canCallFoulUntil = 0;
                    return;
                }
                (0, out_1.freeKick)(game, pp.team, pp.fouledAt);
                pp.activation = 0;
                pp.canCallFoulUntil = 0;
                return;
            }
            if (pp.slowdown && new Date().getTime() > pp.canCallFoulUntil) {
                pp.activation = 0;
                return;
            }
            if (pp.activation > 20 && pp.activation < 60) {
                index_1.room.setPlayerAvatar(pp.id, "👟");
            }
            else if (pp.activation >= 60 && pp.activation < 100) {
                index_1.room.setPlayerAvatar(pp.id, "⚡");
            }
            else if (pp.activation >= 100) {
                index_1.room.setPlayerAvatar(pp.id, "");
            }
            // When X is RELEASED
        }
        else if (pp.activation > 20 && pp.activation < 60) {
            pp.activation = 0;
            if (!game.inPlay) {
                index_1.room.setPlayerAvatar(pp.id, "🚫");
                setTimeout(() => index_1.room.setPlayerAvatar(pp.id, ""), 200);
                return;
            }
            slide(game, pp);
        }
        else if (pp.activation >= 60 && pp.activation < 100) {
            pp.activation = 0;
            if (!game.inPlay) {
                index_1.room.setPlayerAvatar(pp.id, "🚫");
                setTimeout(() => index_1.room.setPlayerAvatar(pp.id, ""), 200);
                return;
            }
            if (pp.cooldownUntil > new Date().getTime()) {
                (0, message_1.sendMessage)(`Cooldown: ${Math.ceil((pp.cooldownUntil - new Date().getTime()) / 1000)}s.`, pp);
                pp.activation = 0;
                index_1.room.setPlayerAvatar(pp.id, "🚫");
                setTimeout(() => index_1.room.setPlayerAvatar(pp.id, ""), 200);
                return;
            }
            (0, exports.sprint)(game, pp);
            index_1.room.setPlayerAvatar(pp.id, "⚡");
            setTimeout(() => index_1.room.setPlayerAvatar(pp.id, ""), 700);
            pp.cooldownUntil = new Date().getTime() + 18000;
            if (process.env.DEBUG) {
                pp.cooldownUntil = new Date().getTime() + 3000;
            }
        }
        else {
            pp.activation = 0;
        }
    });
};
exports.checkAllX = checkAllX;
const sprint = (game, p) => {
    if (p.slowdown) {
        return;
    }
    const props = index_1.room.getPlayerDiscProperties(p.id);
    const magnitude = Math.sqrt(props.xspeed ** 2 + props.yspeed ** 2);
    const vecX = props.xspeed / magnitude;
    const vecY = props.yspeed / magnitude;
    index_1.room.setPlayerDiscProperties(p.id, {
        xgravity: vecX * 0.08,
        ygravity: vecY * 0.08,
    });
    setTimeout(() => index_1.room.setPlayerDiscProperties(p.id, { xgravity: 0, ygravity: 0 }), 1000);
};
exports.sprint = sprint;
const slide = (game, p) => __awaiter(void 0, void 0, void 0, function* () {
    if (p.slowdown) {
        return;
    }
    if (game.animation) {
        index_1.room.setPlayerAvatar(p.id, "");
        return;
    }
    const props = index_1.room.getPlayerDiscProperties(p.id);
    if (p.cooldownUntil > new Date().getTime()) {
        (0, message_1.sendMessage)(`Cooldown: ${Math.ceil((p.cooldownUntil - new Date().getTime()) / 1000)}s`, p);
        p.activation = 0;
        index_1.room.setPlayerAvatar(p.id, "🚫");
        setTimeout(() => index_1.room.setPlayerAvatar(p.id, ""), 200);
        return;
    }
    index_1.room.setPlayerDiscProperties(p.id, {
        xspeed: props.xspeed * 3.4,
        yspeed: props.yspeed * 3.4,
        xgravity: -props.xspeed * 0.026,
        ygravity: -props.yspeed * 0.026,
    });
    index_1.room.setPlayerAvatar(p.id, "👟");
    p.cooldownUntil = new Date().getTime() + 23000;
    if (process.env.DEBUG) {
        p.cooldownUntil = new Date().getTime() + 3000;
    }
    p.sliding = true;
    yield (0, utils_1.sleep)(900);
    p.sliding = false;
    p.slowdown = 0.13;
    p.slowdownUntil = new Date().getTime() + 1000 * 3;
    index_1.room.setPlayerAvatar(p.id, "");
});
const rotateBall = (game) => {
    if (game.ballRotation.power < 0.02) {
        game.ballRotation.power = 0;
        index_1.room.setDiscProperties(0, {
            xgravity: 0,
            ygravity: 0,
        });
        return;
    }
    index_1.room.setDiscProperties(0, {
        xgravity: 0.01 * game.ballRotation.x * game.ballRotation.power,
        ygravity: 0.01 * game.ballRotation.y * game.ballRotation.power,
    });
    //game.ballRotation.power *= 0.95;
    game.ballRotation.power *= 0.735;
};
exports.rotateBall = rotateBall;
