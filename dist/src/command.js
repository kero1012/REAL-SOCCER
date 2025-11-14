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
exports.handleCommand = exports.isCommand = void 0;
const message_1 = require("./message");
const fs = __importStar(require("fs"));
const index_1 = require("../index");
const chooser_1 = require("./chooser");
const index_2 = require("../index");
const draft_1 = require("./draft/draft");
const settings_1 = require("./settings");
const chooser_2 = require("./chooser");
const config_1 = __importDefault(require("../config"));
const isCommand = (msg) => msg.trim().startsWith("!");
exports.isCommand = isCommand;
const handleCommand = (p, msg) => {
    let commandText = msg.trim().slice(1);
    let commandName = commandText.split(" ")[0];
    let commandArgs = commandText.split(" ").slice(1);
    if (commands[commandName]) {
        commands[commandName](p, commandArgs);
    }
    else {
        (0, message_1.sendMessage)("Command not found.", p);
    }
};
exports.handleCommand = handleCommand;
const commands = {
    afk: (p) => setAfk(p),
    back: (p) => setBack(p),
    discord: (p) => showDiscord(p),
    dc: (p) => showDiscord(p),
    bb: (p) => bb(p),
    help: (p) => showHelp(p),
    admin: (p, args) => adminLogin(p, args),
    draft: (p) => draft(p),
    pick: (p, args) => pick(p, args),
    rs: (p) => rs(p),
    script: (p) => script(p),
    version: (p) => showVersion(p),
};
const adminLogin = (p, args) => {
    if (args.length < 1) {
        (0, message_1.sendMessage)("Usage: !admin your_admin_pass", p);
        return;
    }
    if (args[0] === index_2.adminPass) {
        index_1.room.setPlayerAdmin(p.id, true);
        (0, message_1.sendMessage)("Login successful.", p);
    }
    else {
        (0, message_1.sendMessage)("Wrong password.", p);
    }
};
const draft = (p) => __awaiter(void 0, void 0, void 0, function* () {
    if (!index_1.room.getPlayer(p.id).admin) {
        (0, message_1.sendMessage)("❌ ADMIN only command. If you're an admin, log in with !admin", p);
        return;
    }
    (0, message_1.sendMessage)(`${p.name} started captain draft mode.`);
    (0, chooser_2.changeDuringDraft)(true);
    try {
        const result = yield (0, draft_1.performDraft)(index_1.room, index_1.room.getPlayerList(), settings_1.teamSize);
        if (!result) {
            (0, message_1.sendMessage)("Draft ended without forming teams.");
        }
    }
    finally {
        (0, chooser_2.changeDuringDraft)(false);
    }
});
const pick = (p, args) => {
    if (!(0, draft_1.isDraftRunning)()) {
        (0, message_1.sendMessage)("There is no active draft right now.", p);
        return;
    }
    if (args.length < 1) {
        (0, message_1.sendMessage)("Usage: !pick number", p);
        return;
    }
    const value = Number(args[0]);
    if (!Number.isInteger(value)) {
        (0, message_1.sendMessage)("Pick number must be an integer.", p);
        return;
    }
    (0, draft_1.handleDraftPick)(p, value);
};
const rs = (p) => {
    if (!index_1.room.getPlayer(p.id).admin) {
        (0, message_1.sendMessage)("❌ ADMIN only command. If you're an admin, log in with !admin", p);
        return;
    }
    index_1.room.stopGame();
    const rsStadium = fs.readFileSync("./maps/rs5.hbs", {
        encoding: "utf8",
        flag: "r",
    });
    index_1.room.setCustomStadium(rsStadium);
    (0, message_1.sendMessage)(`${p.name} has changed map to JJRS`);
};
const setAfk = (p) => {
    p.afk = true;
    index_1.room.setPlayerTeam(p.id, 0);
    (0, message_1.sendMessage)("You are now AFK.", p);
    (0, chooser_1.handlePlayerLeaveOrAFK)();
};
const setBack = (p) => {
    if (!p.afk) {
        (0, message_1.sendMessage)("You are ALREADY back.", p);
        return;
    }
    p.afk = false;
    (0, chooser_1.addToGame)(index_1.room, index_1.room.getPlayer(p.id));
    (0, message_1.sendMessage)("You are BACK.", p);
};
const showHelp = (p) => {
    (0, message_1.sendMessage)(`${config_1.default.roomName}. Commands: ${Object.keys(commands)
        .map((k) => "!" + k)
        .join(", ")}`, p);
};
const showDiscord = (p) => {
    (0, message_1.sendMessage)(`Discord: you can past your discord server here Contact me : kerolos0872`);
};
const bb = (p) => {
    index_1.room.kickPlayer(p.id, "Bye!\nJoin our Discord:\nyou can past your discord server here Contact me : kerolos0872", false);
};
const script = (p) => {
    // If you did not change this line, thank you!
    (0, message_1.sendMessage)("JJRS is Open Source. Full Script: github.com/jakjus/jjrs", p);
};
const showVersion = (p) => {
    // If you did not change this line, thank you!
    (0, message_1.sendMessage)(`JJRS v${index_1.version}. Full Script: github.com/jakjus/jjrs`, p);
};
