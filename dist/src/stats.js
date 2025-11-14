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
exports.matchStats = void 0;
exports.initPlayerStats = initPlayerStats;
exports.trackBallTouch = trackBallTouch;
exports.trackGoal = trackGoal;
exports.trackSave = trackSave;
exports.trackTackle = trackTackle;
exports.trackPass = trackPass;
exports.calculateRating = calculateRating;
exports.getMVP = getMVP;
exports.calculateAllRatings = calculateAllRatings;
exports.saveMatchStatsToDB = saveMatchStatsToDB;
exports.announceMVP = announceMVP;
exports.announceRatings = announceRatings;
exports.isRankedMatch = isRankedMatch;
exports.announceMatchType = announceMatchType;
exports.resetMatchStats = resetMatchStats;
exports.initAllPlayers = initAllPlayers;
const index_1 = require("../index");
const message_1 = require("./message");
const db_1 = require("./db");
// Store stats in memory during match
exports.matchStats = new Map();
let lastKicker = null;
let secondLastKicker = null;
let lastKickTime = 0;
// Initialize player stats
function initPlayerStats(player) {
    if (!exports.matchStats.has(player.id)) {
        exports.matchStats.set(player.id, {
            id: player.id,
            auth: player.auth,
            name: player.name,
            goals: 0,
            assists: 0,
            saves: 0,
            tackles: 0,
            passes: 0,
            passSuccess: 0,
            touches: 0,
            lastTouch: 0,
            rating: 0,
            team: player.team
        });
    }
    else {
        // Update team if player already exists
        const stats = exports.matchStats.get(player.id);
        stats.team = player.team;
    }
}
// Track ball touches
function trackBallTouch(player) {
    const stats = exports.matchStats.get(player.id);
    if (stats) {
        stats.touches++;
        stats.lastTouch = Date.now();
        // Track for assist calculation
        if (lastKicker !== player.id) {
            secondLastKicker = lastKicker;
            lastKicker = player.id;
            lastKickTime = Date.now();
        }
    }
}
// Track goal and assist
function trackGoal(scorerTeam) {
    if (!lastKicker)
        return;
    const scorer = exports.matchStats.get(lastKicker);
    if (!scorer)
        return;
    // Check if own goal or regular goal
    if (scorer.team === scorerTeam) {
        // Regular goal
        scorer.goals++;
        // Check for assist (last touch by teammate within 5 seconds)
        if (secondLastKicker && secondLastKicker !== lastKicker) {
            const assister = exports.matchStats.get(secondLastKicker);
            const timeDiff = Date.now() - lastKickTime;
            if (assister && assister.team === scorer.team && timeDiff < 5000) {
                assister.assists++;
            }
        }
    }
}
// Track save
function trackSave(player) {
    const stats = exports.matchStats.get(player.id);
    if (stats) {
        stats.saves++;
    }
}
// Track tackle
function trackTackle(player) {
    const stats = exports.matchStats.get(player.id);
    if (stats) {
        stats.tackles++;
    }
}
// Track pass (called when teamplay boost happens)
function trackPass(player, successful) {
    const stats = exports.matchStats.get(player.id);
    if (stats) {
        stats.passes++;
        if (successful)
            stats.passSuccess++;
    }
}
// Calculate player rating (FIFA-style)
function calculateRating(stats) {
    const baseRating = 5.0; // Start at 5/10
    // Points for different actions
    const goalPoints = stats.goals * 1.0;
    const assistPoints = stats.assists * 0.7;
    const savePoints = stats.saves * 0.5;
    const tacklePoints = stats.tackles * 0.3;
    const passPoints = (stats.passSuccess / Math.max(1, stats.passes)) * 0.5;
    const touchPoints = Math.min(stats.touches * 0.01, 0.5); // Cap at 0.5
    // Calculate final rating (max 10)
    const totalPoints = goalPoints + assistPoints + savePoints + tacklePoints + passPoints + touchPoints;
    const rating = Math.min(10, baseRating + totalPoints);
    return Math.round(rating * 10) / 10; // Round to 1 decimal
}
// Get MVP based on performance
function getMVP() {
    let bestPlayer = null;
    let bestScore = -1;
    exports.matchStats.forEach((stats) => {
        // Only consider players who were on a team
        if (stats.team === 0)
            return;
        // MVP Score calculation
        const mvpScore = (stats.goals * 3) + (stats.assists * 2) + (stats.saves * 1) + (stats.touches * 0.05);
        if (mvpScore > bestScore) {
            bestScore = mvpScore;
            bestPlayer = stats;
        }
    });
    return bestPlayer;
}
// Calculate all player ratings
function calculateAllRatings() {
    exports.matchStats.forEach((stats) => {
        stats.rating = calculateRating(stats);
    });
}
// Save match stats to database (called once at match end)
function saveMatchStatsToDB() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Calculate ratings before saving
            calculateAllRatings();
            // Save each player's stats with single update query
            for (const [_, stats] of exports.matchStats) {
                if (stats.team === 0)
                    continue; // Skip spectators
                yield db_1.db.run(`UPDATE players 
         SET goals = goals + ?, 
             assists = assists + ?,
             matches = matches + 1
         WHERE auth = ?`, [stats.goals, stats.assists, stats.auth]).catch(() => {
                    // If player doesn't exist, insert them
                    db_1.db.run(`INSERT INTO players (auth, name, goals, assists, matches, elo) 
           VALUES (?, ?, ?, ?, 1, 1000)`, [stats.auth, stats.name, stats.goals, stats.assists]);
                });
            }
        }
        catch (error) {
            console.error("Error saving match stats:", error);
        }
    });
}
// Show MVP announcement
function announceMVP() {
    const mvp = getMVP();
    if (mvp) {
        (0, message_1.sendMessage)(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
        (0, message_1.sendMessage)(`🏆 MVP OF THE MATCH: ${mvp.name}`);
        (0, message_1.sendMessage)(`⚽ Goals: ${mvp.goals} | 🎯 Assists: ${mvp.assists} | 💾 Saves: ${mvp.saves}`);
        (0, message_1.sendMessage)(`📊 Rating: ${mvp.rating}/10`);
        (0, message_1.sendMessage)(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
}
// Show all player ratings
function announceRatings() {
    calculateAllRatings();
    const sortedPlayers = Array.from(exports.matchStats.values())
        .filter(s => s.team !== 0) // Exclude spectators
        .sort((a, b) => b.rating - a.rating);
    if (sortedPlayers.length === 0)
        return;
    (0, message_1.sendMessage)(`📊 PLAYER RATINGS:`);
    sortedPlayers.forEach((stats, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
        (0, message_1.sendMessage)(`${medal} ${stats.name}: ${stats.rating}/10 (G:${stats.goals} A:${stats.assists} S:${stats.saves})`);
    });
}
// Check if match is ranked (4v4 or more)
function isRankedMatch() {
    const redTeam = index_1.room.getPlayerList().filter(p => p.team === 1).length;
    const blueTeam = index_1.room.getPlayerList().filter(p => p.team === 2).length;
    return redTeam >= 4 && blueTeam >= 4;
}
// Announce match type
function announceMatchType() {
    if (isRankedMatch()) {
        (0, message_1.sendMessage)(`⚔️ RANKED MATCH - ELO will be updated`);
    }
    else {
        (0, message_1.sendMessage)(`🎮 UNRANKED MATCH - Practice mode`);
    }
}
// Reset stats for new match
function resetMatchStats() {
    exports.matchStats.clear();
    lastKicker = null;
    secondLastKicker = null;
    lastKickTime = 0;
}
// Initialize all players currently in room
function initAllPlayers() {
    index_1.room.getPlayerList().forEach(p => {
        if (p.id !== 0) { // Exclude host
            initPlayerStats((0, index_1.toAug)(p));
        }
    });
}
