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
exports.isDraftRunning = exports.handleDraftPick = exports.performDraft = void 0;
const message_1 = require("../message");
const __1 = require("../..");
let draftState = null;
const teamKey = (team) => (team === 1 ? "red" : "blue");
const candidateFromPlayer = (player) => {
    try {
        const aug = (0, __1.toAug)(player);
        return {
            id: player.id,
            auth: aug.auth,
            name: player.name,
            elo: aug.elo,
        };
    }
    catch (_a) {
        return null;
    }
};
const getCaptain = (state, team) => { var _a; return (_a = state.captains.find((c) => c.team === team)) !== null && _a !== void 0 ? _a : null; };
const purgeMissingCandidates = (state) => {
    state.available = state.available.filter((candidate) => state.room.getPlayer(candidate.id));
};
const announcePlayers = (state) => {
    purgeMissingCandidates(state);
    if (state.available.length === 0) {
        return;
    }
    (0, message_1.sendMessage)("Available players:");
    state.available.forEach((candidate, index) => {
        (0, message_1.sendMessage)(`${index + 1}. ${candidate.name} (${candidate.elo})`);
    });
};
const shiftNextAvailable = (state) => {
    while (state.available.length > 0) {
        const candidate = state.available.shift();
        if (state.room.getPlayer(candidate.id)) {
            return candidate;
        }
    }
    return null;
};
const collectTeamPlayers = (state, team) => {
    const key = teamKey(team);
    return state.teams[key]
        .map((candidate) => state.room.getPlayer(candidate.id))
        .filter((p) => !!p);
};
const finalizeDraft = (state, cancelled) => {
    if (state.pendingTimeout) {
        clearTimeout(state.pendingTimeout);
    }
    state.pendingResolve = undefined;
    state.pendingTimeout = undefined;
    if (cancelled) {
        draftState = null;
        state.resolve(null);
        return;
    }
    state.available.forEach((candidate) => {
        const player = state.room.getPlayer(candidate.id);
        if (player && state.afkHandler) {
            state.afkHandler(player);
        }
    });
    const redPlayers = collectTeamPlayers(state, 1);
    const bluePlayers = collectTeamPlayers(state, 2);
    (0, message_1.sendMessage)("Draft finished.");
    draftState = null;
    state.resolve({ red: redPlayers, blue: bluePlayers });
};
const assignCandidate = (state, team, candidate) => {
    const player = state.room.getPlayer(candidate.id);
    if (!player) {
        (0, message_1.sendMessage)(`${candidate.name} is no longer in the room. Pick again.`);
        return false;
    }
    const key = teamKey(team);
    state.teams[key].push(candidate);
    state.room.setPlayerTeam(candidate.id, team);
    (0, message_1.sendMessage)(`${candidate.name} (${candidate.elo}) joined ${team === 1 ? "🔴 Red" : "🔵 Blue"} team.`);
    return true;
};
const waitForPick = (state, team) => new Promise((resolve) => {
    purgeMissingCandidates(state);
    if (state.available.length === 0) {
        resolve(null);
        return;
    }
    const captain = getCaptain(state, team);
    const captainPlayer = captain ? state.room.getPlayer(captain.id) : null;
    if (!captain || !captainPlayer) {
        (0, message_1.sendMessage)("Draft cancelled because a captain left.");
        finalizeDraft(state, true);
        resolve(null);
        return;
    }
    (0, message_1.sendMessage)(`It's your turn to pick. Use !pick <number> within ${state.timeoutMs / 1000}s.`, captainPlayer);
    announcePlayers(state);
    state.pendingResolve = (candidate) => resolve(candidate);
    state.pendingTimeout = setTimeout(() => {
        state.pendingTimeout = undefined;
        state.pendingResolve = undefined;
        const autoCandidate = shiftNextAvailable(state);
        if (autoCandidate) {
            (0, message_1.sendMessage)(`${autoCandidate.name} auto-picked for ${team === 1 ? "🔴 Red" : "🔵 Blue"} team.`);
        }
        resolve(autoCandidate);
    }, state.timeoutMs);
});
const runDraft = (state) => __awaiter(void 0, void 0, void 0, function* () {
    for (state.sequenceIndex = 0; state.sequenceIndex < state.sequence.length;) {
        if (draftState !== state) {
            return;
        }
        if (state.available.length === 0) {
            break;
        }
        const team = state.sequence[state.sequenceIndex];
        const candidate = yield waitForPick(state, team);
        if (draftState !== state) {
            return;
        }
        if (!candidate) {
            state.sequenceIndex += 1;
            continue;
        }
        state.pendingResolve = undefined;
        state.pendingTimeout = undefined;
        const assigned = assignCandidate(state, team, candidate);
        if (draftState !== state) {
            return;
        }
        if (assigned) {
            state.sequenceIndex += 1;
        }
    }
    if (draftState === state) {
        finalizeDraft(state, false);
    }
});
const performDraft = (room, players, maxTeamSize, afkHandler) => __awaiter(void 0, void 0, void 0, function* () {
    if (draftState) {
        (0, message_1.sendMessage)("Draft is already running.");
        return null;
    }
    room.stopGame();
    const livePlayers = players
        .map((p) => room.getPlayer(p.id))
        .filter((p) => !!p);
    const sorted = [...livePlayers].sort((a, b) => (0, __1.toAug)(b).elo - (0, __1.toAug)(a).elo);
    if (sorted.length < 2) {
        (0, message_1.sendMessage)("Not enough players for draft.");
        return null;
    }
    const totalSlots = Math.min(sorted.length, maxTeamSize * 2);
    const participants = sorted.slice(0, totalSlots);
    participants.forEach((p) => room.setPlayerTeam(p.id, 0));
    const redCaptainPlayer = participants[0];
    const blueCaptainPlayer = participants[1];
    const redCaptain = candidateFromPlayer(redCaptainPlayer);
    const blueCaptain = candidateFromPlayer(blueCaptainPlayer);
    if (!redCaptain || !blueCaptain) {
        (0, message_1.sendMessage)("Unable to determine captains.");
        return null;
    }
    room.setPlayerTeam(redCaptain.id, 1);
    room.setPlayerTeam(blueCaptain.id, 2);
    const remaining = participants
        .slice(2)
        .map((p) => candidateFromPlayer(p))
        .filter((c) => !!c);
    const picksCapacity = Math.max(maxTeamSize * 2 - 2, 0);
    const available = remaining.slice(0, picksCapacity);
    const overflow = remaining.slice(picksCapacity);
    overflow.forEach((candidate) => {
        const player = room.getPlayer(candidate.id);
        if (player && afkHandler) {
            afkHandler(player);
        }
    });
    (0, message_1.sendMessage)(`Draft started. Captains: 🔴 ${redCaptain.name} vs 🔵 ${blueCaptain.name}.`);
    (0, message_1.sendMessage)("Use !pick <number> to choose teammates. 20 seconds per pick.");
    const sequence = [];
    let round = 0;
    const totalPicks = available.length;
    while (sequence.length < totalPicks) {
        if (round % 2 === 0) {
            if (sequence.length < totalPicks) {
                sequence.push(1);
            }
            if (sequence.length < totalPicks) {
                sequence.push(2);
            }
        }
        else {
            if (sequence.length < totalPicks) {
                sequence.push(2);
            }
            if (sequence.length < totalPicks) {
                sequence.push(1);
            }
        }
        round += 1;
    }
    return yield new Promise((resolve) => {
        draftState = {
            room,
            captains: [
                Object.assign(Object.assign({}, redCaptain), { team: 1 }),
                Object.assign(Object.assign({}, blueCaptain), { team: 2 }),
            ],
            available,
            teams: {
                red: [redCaptain],
                blue: [blueCaptain],
            },
            sequence,
            sequenceIndex: 0,
            pendingResolve: undefined,
            pendingTimeout: undefined,
            timeoutMs: 20000,
            resolve,
            afkHandler,
        };
        runDraft(draftState);
    });
});
exports.performDraft = performDraft;
const handleDraftPick = (player, selection) => {
    const state = draftState;
    if (!state || state.pendingResolve === undefined) {
        (0, message_1.sendMessage)("There is no pick pending right now.", player);
        return;
    }
    const team = state.sequence[state.sequenceIndex];
    const captain = getCaptain(state, team);
    if (!captain || captain.id !== player.id) {
        (0, message_1.sendMessage)("You are not the captain picking now.", player);
        return;
    }
    if (!Number.isInteger(selection) || selection < 1) {
        (0, message_1.sendMessage)("Invalid pick number.", player);
        return;
    }
    if (selection > state.available.length) {
        (0, message_1.sendMessage)("Pick number is out of range.", player);
        return;
    }
    const resolver = state.pendingResolve;
    if (state.pendingTimeout) {
        clearTimeout(state.pendingTimeout);
        state.pendingTimeout = undefined;
    }
    state.pendingResolve = undefined;
    const candidate = state.available.splice(selection - 1, 1)[0];
    if (resolver) {
        resolver(candidate);
    }
};
exports.handleDraftPick = handleDraftPick;
const isDraftRunning = () => draftState !== null;
exports.isDraftRunning = isDraftRunning;
