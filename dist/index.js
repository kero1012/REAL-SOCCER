"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPass = exports.db = exports.game = exports.room = exports.toAug = exports.players = exports.Game = exports.PlayerAugmented = exports.version = void 0;
const chooser_1 = require("./src/chooser");
const command_1 = require("./src/command");
const message_1 = require("./src/message");
const stats = __importStar(require("./src/stats"));
const out_1 = require("./src/out");
const superpower_1 = require("./src/superpower");
const offside_1 = require("./src/offside");
const foul_1 = require("./src/foul");
const fs = __importStar(require("fs"));
const slowdown_1 = require("./src/slowdown");
const chooser_2 = __importDefault(require("./src/chooser"));
const welcome_1 = require("./src/welcome");
const db_1 = require("./src/db");
const teamplayBoost_1 = require("./src/teamplayBoost");
const rotateBall_1 = require("./src/rotateBall");
const afk_1 = require("./src/afk");
const crypto = __importStar(require("node:crypto"));
exports.version = '1.3.6 (16/09/2025)';
class PlayerAugmented {
    constructor(p) {
        this.id = p.id;
        this.name = p.name;
        this.auth = p.auth;
        this.conn = p.conn;
        this.team = p.team;
        this.foulsMeter = p.foulsMeter || 0;
        this.cardsAnnounced = p.cardsAnnounced || 0;
        this.activation = 0;
        this.sliding = false;
        this.slowdown = p.slowdown || 0;
        this.slowdownUntil = p.slowdownUntil || 0;
        this.cooldownUntil = p.cooldownUntil || 0;
        this.canCallFoulUntil = 0;
        this.fouledAt = { x: 0, y: 0 };
        this.afk = false;
        this.afkCounter = 0;
        this.elo = 1200;
    }
    get position() {
        return exports.room.getPlayer(this.id).position;
    }
}
exports.PlayerAugmented = PlayerAugmented;
let gameId = 0;
class Game {
    constructor() {
        gameId += 1;
        this.id = gameId;
        this.eventCounter = 0; // to debounce some events
        this.inPlay = true;
        this.lastTouch = null;
        this.previousTouch = null;
        this.lastKick = null;
        this.animation = false;
        this.ballRotation = { x: 0, y: 0, power: 0 };
        this.positionsDuringPass = [];
        this.skipOffsideCheck = false;
        this.holdPlayers = JSON.parse(JSON.stringify(exports.players.map(p => { return { id: p.id, auth: p.auth, team: p.team }; })));
        this.rotateNextKick = false;
        this.boostCount = 0;
    }
    rotateBall() {
        (0, superpower_1.rotateBall)(this);
    }
    handleBallTouch() {
        var _a;
        const ball = exports.room.getDiscProperties(0);
        if (!ball) {
            return;
        }
        // Power bar check moved to onGameTick with frame skipping
        for (const p of exports.room.getPlayerList()) {
            const prop = exports.room.getPlayerDiscProperties(p.id);
            if (!prop) {
                continue;
            }
            const dist = Math.sqrt((prop.x - ball.x) ** 2 + (prop.y - ball.y) ** 2);
            const isTouching = dist < prop.radius + ball.radius + 0.1;
            if (isTouching) {
                const pAug = (0, exports.toAug)(p);
                pAug.sliding = false;
                (0, offside_1.handleLastTouch)(this, pAug);
                // Track ball touch for stats
                stats.trackBallTouch(pAug);
            }
            // Used for cancelling teamplay. I dont want to enemy
            // team to be able to hit boosted ball when intercepting
            // strength
            if ((((_a = this.lastKick) === null || _a === void 0 ? void 0 : _a.team) == p.team) || !this.inPlay) {
                continue;
            }
            const distPredicted = Math.sqrt(((prop.x + prop.xspeed * 2) - (ball.x + ball.xspeed * 2)) ** 2 + ((prop.y + prop.yspeed * 2) - (ball.y + ball.yspeed * 2)) ** 2);
            const isAlmostTouching = distPredicted < prop.radius + ball.radius + 5;
            if (isAlmostTouching) {
                this.boostCount = 0;
                this.lastKick = null;
                (0, teamplayBoost_1.setBallInvMassAndColor)(this);
            }
        }
    }
    handleBallOutOfBounds() {
        (0, out_1.handleBallOutOfBounds)(this);
    }
    handleBallInPlay() {
        (0, out_1.handleBallInPlay)(this);
    }
    checkAllX() {
        (0, superpower_1.checkAllX)(this);
    }
    checkFoul() {
        (0, foul_1.checkFoul)();
    }
    applySlowdown() {
        (0, slowdown_1.applySlowdown)();
    }
}
exports.Game = Game;
exports.players = [];
let toAug = (p) => {
    const found = exports.players.find((pp) => pp.id == p.id);
    if (!found) {
        throw (`Lookup for player with id ${p.id} failed. Player is not in the players array: ${JSON.stringify(exports.players)}`);
    }
    return found;
};
exports.toAug = toAug;
exports.adminPass = crypto.randomBytes(6).toString("hex");
const roomBuilder = (HBInit, args) => __awaiter(void 0, void 0, void 0, function* () {
    exports.room = HBInit(args);
    exports.db = yield (0, db_1.initDb)();
    const rsStadium = fs.readFileSync("./maps/rs5.hbs", {
        encoding: "utf8",
        flag: "r",
    });
    exports.room.setCustomStadium(rsStadium);
    exports.room.setTimeLimit(5);
    exports.room.setScoreLimit(3);
    exports.room.setTeamsLock(true);
    if (process.env.DEBUG) {
        exports.room.setScoreLimit(1);
        exports.room.setTimeLimit(1);
    }
    exports.room.startGame();
    let i = 0;
    exports.room.onTeamGoal = (team) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // Track goal for stats
        if (stats) {
            stats.trackGoal(team);
        }
        if (((_a = exports.game === null || exports.game === void 0 ? void 0 : exports.game.lastTouch) === null || _a === void 0 ? void 0 : _a.byPlayer.team) === team) {
            (0, message_1.sendMessage)(`Goal! Player ${(_b = exports.game === null || exports.game === void 0 ? void 0 : exports.game.lastTouch) === null || _b === void 0 ? void 0 : _b.byPlayer.name} scored! 🥅`);
            if (((_c = exports.game === null || exports.game === void 0 ? void 0 : exports.game.previousTouch) === null || _c === void 0 ? void 0 : _c.byPlayer.id) !== ((_d = exports.game === null || exports.game === void 0 ? void 0 : exports.game.lastTouch) === null || _d === void 0 ? void 0 : _d.byPlayer.id) && ((_e = exports.game === null || exports.game === void 0 ? void 0 : exports.game.previousTouch) === null || _e === void 0 ? void 0 : _e.byPlayer.team) === ((_f = exports.game === null || exports.game === void 0 ? void 0 : exports.game.lastTouch) === null || _f === void 0 ? void 0 : _f.byPlayer.team)) {
                (0, message_1.sendMessage)(`Assist by ${(_g = exports.game === null || exports.game === void 0 ? void 0 : exports.game.previousTouch) === null || _g === void 0 ? void 0 : _g.byPlayer.name}! 🎯`);
            }
        }
        else {
            (0, message_1.sendMessage)(`Own goal by ${(_h = exports.game === null || exports.game === void 0 ? void 0 : exports.game.lastTouch) === null || _h === void 0 ? void 0 : _h.byPlayer.name}! 😱`);
        }
    };
    exports.room.onGameTick = () => {
        if (!exports.game) {
            return;
        }
        try {
            i++;
            exports.game.handleBallTouch();
            // Update power bar with reduced frequency for performance
            if (i > 5 && exports.game.powerBar && exports.game.isSetPiece) {
                exports.game.powerBar.checkActivation(exports.game.isSetPiece);
                exports.game.powerBar.update();
            }
            if (i > 6) {
                if (exports.game.inPlay) {
                    exports.game.handleBallOutOfBounds();
                    exports.game.rotateBall();
                }
                else {
                    exports.game.handleBallInPlay();
                }
                exports.game.applySlowdown();
                afk_1.afk.onTick();
                exports.game.checkAllX();
                exports.game.checkFoul();
                i = 0;
            }
        }
        catch (e) {
            console.log("Error:", e);
        }
    };
    exports.room.onPlayerActivity = (p) => {
        afk_1.afk.onActivity(p);
    };
    exports.room.onPlayerJoin = (p) => __awaiter(void 0, void 0, void 0, function* () {
        if (!p.auth) {
            exports.room.kickPlayer(p.id, "Your auth key is invalid. Change at haxball.com/playerauth", false);
            return;
        }
        if (process.env.DEBUG) {
            exports.room.setPlayerAdmin(p.id, true);
        }
        else {
            if (exports.players.map((p) => p.auth).includes(p.auth)) {
                exports.room.kickPlayer(p.id, "You are already on the server.", false);
                return;
            }
        }
        exports.players.push(new PlayerAugmented(p));
        // Initialize stats for new player
        stats.initPlayerStats((0, exports.toAug)(p));
        (0, welcome_1.welcomePlayer)(exports.room, p);
        // Auto balance teams for new players
        if (!chooser_1.duringDraft) { // Don't auto-balance during draft
            const redCount = exports.room.getPlayerList().filter(player => player.team === 1).length;
            const blueCount = exports.room.getPlayerList().filter(player => player.team === 2).length;
            // Auto-assign to team with fewer players (max 6 per team)
            if (redCount < 6 || blueCount < 6) { // At least one team has space
                if (redCount < blueCount) {
                    exports.room.setPlayerTeam(p.id, 1); // Join red team
                    (0, message_1.sendMessage)(`🔴 Auto-joined Red Team`, p);
                }
                else if (blueCount < redCount) {
                    exports.room.setPlayerTeam(p.id, 2); // Join blue team
                    (0, message_1.sendMessage)(`🔵 Auto-joined Blue Team`, p);
                }
                else if (redCount === blueCount && redCount < 6) {
                    // Both teams equal and have space, join red by default
                    exports.room.setPlayerTeam(p.id, 1);
                    (0, message_1.sendMessage)(`🔴 Auto-joined Red Team`, p);
                }
            }
        }
    });
    exports.room.onPlayerLeave = (p) => __awaiter(void 0, void 0, void 0, function* () {
        exports.players = exports.players.filter((pp) => p.id != pp.id);
        yield (0, chooser_1.handlePlayerLeaveOrAFK)();
    });
    exports.room.onPlayerChat = (p, msg) => {
        const pp = (0, exports.toAug)(p);
        if (process.env.DEBUG) {
            if (msg == "a") {
                exports.room.setPlayerDiscProperties(p.id, { x: -10 });
            }
        }
        if (msg == "!debug") {
            console.log(exports.game);
            return false;
        }
        if ((0, command_1.isCommand)(msg)) {
            (0, command_1.handleCommand)(pp, msg);
            return false;
        }
        (0, message_1.playerMessage)(pp, msg);
        return false;
    };
    exports.room.onGameStart = (_) => {
        exports.players.forEach((p) => {
            p.slowdownUntil = 0;
            p.foulsMeter = 0;
            p.cardsAnnounced = 0;
            p.activation = 0;
            p.sliding = false;
            p.slowdown = 0;
            p.slowdownUntil = 0;
            p.cooldownUntil = 0;
            p.canCallFoulUntil = 0;
        });
        if (!chooser_1.duringDraft) {
            exports.game = new Game();
        }
        (0, out_1.clearThrowInBlocks)();
        exports.room.getPlayerList().forEach((p) => exports.room.setPlayerAvatar(p.id, ""));
        // Reset and initialize match stats
        stats.resetMatchStats();
        stats.initAllPlayers();
        // Announce match type (ranked/unranked)
        stats.announceMatchType();
        if (exports.game && exports.game.powerBar) {
            exports.game.powerBar.hide();
            exports.game.powerBar = null;
            exports.game.isSetPiece = false;
        }
        exports.room.getPlayerList().forEach((p) => exports.room.setPlayerAvatar(p.id, ""));
    };
    exports.room.onPositionsReset = () => {
        (0, out_1.clearThrowInBlocks)();
        if (exports.game) {
            exports.game.animation = false;
            exports.room.setDiscProperties(0, {
                xspeed: 0,
                yspeed: 0,
                xgravity: 0,
                ygravity: 0,
            }); // without this, there was one tick where the ball's gravity was applied, and the ball has moved after positions reset.
            exports.game.ballRotation = { x: 0, y: 0, power: 0 };
        }
    };
    exports.room.onGameStop = (_) => {
        if (exports.game) {
            exports.game = null;
        }
    };
    exports.room.onPlayerTeamChange = (p) => {
        if (process.env.DEBUG) {
            //room.setPlayerDiscProperties(p.id, {x: -10, y: 0})
        }
        (0, exports.toAug)(p).team = p.team;
        // Update team in stats if player exists
        const playerStats = stats.matchStats.get(p.id);
        if (playerStats) {
            playerStats.team = p.team;
        }
        else {
            // Initialize stats if player joins mid-game
            stats.initPlayerStats((0, exports.toAug)(p));
        }
    };
    exports.room.onPlayerBallKick = (p) => {
        if (exports.game) {
            const pp = (0, exports.toAug)(p);
            // Track ball kick for stats
            stats.trackBallTouch(pp);
            // Apply power bar boost if active
            if (exports.game.powerBar && exports.game.isSetPiece) {
                exports.game.powerBar.applyPower(pp);
            }
            (0, teamplayBoost_1.teamplayBoost)(exports.game, p);
            (0, rotateBall_1.applyRotation)(exports.game, p);
            (0, offside_1.handleLastTouch)(exports.game, pp);
            if (pp.activation > 20) {
                pp.activation = 0;
                exports.room.setPlayerAvatar(p.id, "");
            }
        }
    };
    exports.room.onRoomLink = (url) => {
        console.log(`Room link: ${url}`);
        console.log(`Admin Password: ${exports.adminPass}`);
    };
    (0, chooser_2.default)(exports.room); // must be called at the end
});
exports.default = roomBuilder;
