import { room, PlayerAugmented, toAug, Game } from "../index";
import { sendMessage } from "./message";
import { db } from "./db";

// In-memory stats storage for performance
export interface PlayerStats {
  id: number;
  auth: string;
  name: string;
  goals: number;
  assists: number;
  saves: number;
  tackles: number;
  passes: number;
  passSuccess: number;
  touches: number;
  lastTouch: number;
  rating: number;
  team: number;
}

// Store stats in memory during match
export const matchStats: Map<number, PlayerStats> = new Map();
let lastKicker: number | null = null;
let secondLastKicker: number | null = null;
let lastKickTime: number = 0;

interface AggregatedDbStats {
  auth: string;
  name: string;
  goals: number;
  assists: number;
}

const ensurePlayerRow = async (auth: string, name: string) => {
  await db.run(
    "INSERT OR IGNORE INTO players(auth, name, elo, vip, goals, assists, matches) VALUES(?, ?, 1200, '0', 0, 0, 0)",
    [auth, name],
  );
};

// Initialize player stats
export function initPlayerStats(player: PlayerAugmented): void {
  if (!matchStats.has(player.id)) {
    matchStats.set(player.id, {
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
  } else {
    // Update team if player already exists
    const stats = matchStats.get(player.id)!;
    stats.team = player.team;
  }
}

// Track ball touches
export function trackBallTouch(player: PlayerAugmented): void {
  const stats = matchStats.get(player.id);
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
export function trackGoal(scorerTeam: number): void {
  if (!lastKicker) return;
  
  const scorer = matchStats.get(lastKicker);
  if (!scorer) return;
  
  // Check if own goal or regular goal
  if (scorer.team === scorerTeam) {
    // Regular goal
    scorer.goals++;
    
    // Check for assist (last touch by teammate within 5 seconds)
    if (secondLastKicker && secondLastKicker !== lastKicker) {
      const assister = matchStats.get(secondLastKicker);
      const timeDiff = Date.now() - lastKickTime;
      
      if (assister && assister.team === scorer.team && timeDiff < 5000) {
        assister.assists++;
      }
    }
  }
  
  // Reset tracking variables after goal
  lastKicker = null;
  secondLastKicker = null;
  lastKickTime = 0;
}

// Track save
export function trackSave(player: PlayerAugmented): void {
  const stats = matchStats.get(player.id);
  if (stats) {
    stats.saves++;
  }
}

// Track tackle
export function trackTackle(player: PlayerAugmented): void {
  const stats = matchStats.get(player.id);
  if (stats) {
    stats.tackles++;
  }
}

// Track pass (called when teamplay boost happens)
export function trackPass(player: PlayerAugmented, successful: boolean): void {
  const stats = matchStats.get(player.id);
  if (stats) {
    stats.passes++;
    if (successful) stats.passSuccess++;
  }
}

// Calculate player rating (FIFA-style)
export function calculateRating(stats: PlayerStats): number {
  const baseRating = 5.0; // Start at 5/10
  
  // Points for different actions - Goals matter most!
  const goalPoints = stats.goals * 1.2;      // Increased from 1.0
  const assistPoints = stats.assists * 0.8;  // Increased from 0.7
  const savePoints = stats.saves * 0.6;      // Increased from 0.5
  const tacklePoints = stats.tackles * 0.3;
  const passPoints = (stats.passSuccess / Math.max(1, stats.passes)) * 0.4;
  const touchPoints = Math.min(stats.touches * 0.005, 0.3); // Reduced impact and cap
  
  // Calculate final rating (max 10)
  const totalPoints = goalPoints + assistPoints + savePoints + tacklePoints + passPoints + touchPoints;
  const rating = Math.min(10, baseRating + totalPoints);
  
  return Math.round(rating * 10) / 10; // Round to 1 decimal
}

// Get MVP based on performance
export function getMVP(): PlayerStats | null {
  // First calculate all ratings
  calculateAllRatings();
  
  let bestPlayer: PlayerStats | null = null;
  let bestRating = -1;
  let bestImpact = -1;
  
  matchStats.forEach((stats) => {
    // Only consider players who were on a team
    if (stats.team === 0) return;
    
    // MVP is the player with highest rating
    // In case of tie, use impact score (goals + assists)
    const impactScore = (stats.goals * 2) + stats.assists;
    
    if (stats.rating > bestRating || 
        (stats.rating === bestRating && impactScore > bestImpact)) {
      bestRating = stats.rating;
      bestImpact = impactScore;
      bestPlayer = stats;
    }
  });
  
  return bestPlayer;
}

// Calculate all player ratings
export function calculateAllRatings(): void {
  matchStats.forEach((stats) => {
    stats.rating = calculateRating(stats);
  });
}

// Save match stats to database (called once at match end)
export async function saveMatchStatsToDB(): Promise<void> {
  try {
    // Calculate ratings before saving
    calculateAllRatings();

    const aggregated = new Map<string, AggregatedDbStats>();
    matchStats.forEach((stats) => {
      if (stats.team === 0) {
        return;
      }
      const entry = aggregated.get(stats.auth);
      if (entry) {
        entry.goals += stats.goals;
        entry.assists += stats.assists;
        if (!entry.name && stats.name) {
          entry.name = stats.name;
        }
      } else {
        aggregated.set(stats.auth, {
          auth: stats.auth,
          name: stats.name,
          goals: stats.goals,
          assists: stats.assists,
        });
      }
    });

    for (const entry of aggregated.values()) {
      const baseName = entry.name ?? "";
      await ensurePlayerRow(entry.auth, baseName);
      const updatedName = baseName.trim().length > 0 ? baseName : null;
      await db.run(
        `UPDATE players 
         SET name = COALESCE(?, name),
             goals = goals + ?, 
             assists = assists + ?,
             matches = matches + 1
         WHERE auth = ?`,
        [updatedName, entry.goals, entry.assists, entry.auth],
      );
    }
  } catch (error) {
    console.error("Error saving match stats:", error);
  }
}

// Show MVP announcement
export function announceMVP(): void {
  const mvp = getMVP();
  
  if (mvp) {
    const teamEmoji = mvp.team === 1 ? "🔴" : "🔵";
    const performanceText = mvp.goals > 2 ? " ⭐ OUTSTANDING PERFORMANCE!" : 
                           mvp.goals > 1 ? " 🌟 Great Performance!" : 
                           " ✨ Good Performance!";
    
    sendMessage(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
    sendMessage(`🏆 MVP OF THE MATCH`);
    sendMessage(`${teamEmoji} ${mvp.name} - Rating: ${mvp.rating}/10${performanceText}`);
    sendMessage(`⚽ Goals: ${mvp.goals} | 🎯 Assists: ${mvp.assists} | 💾 Saves: ${mvp.saves} | 👟 Touches: ${mvp.touches}`);
    sendMessage(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
}

// Show all player ratings
export function announceRatings(): void {
  calculateAllRatings();
  
  const sortedPlayers = Array.from(matchStats.values())
    .filter(s => s.team !== 0) // Exclude spectators
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5); // Show only top 5 players
  
  if (sortedPlayers.length === 0) return;
  
  sendMessage(`📊 TOP 5 PLAYER RATINGS:`);
  sortedPlayers.forEach((stats, index) => {
    const rank = `${index + 1}.`;
    const teamEmoji = stats.team === 1 ? "🔴" : "🔵";
    sendMessage(`${rank} ${teamEmoji} ${stats.name}: ${stats.rating}/10 (⚽${stats.goals} 🎯${stats.assists} 💾${stats.saves})`);
  });
}

// Check if match is ranked (4v4 or more)
export function isRankedMatch(): boolean {
  const redTeam = room.getPlayerList().filter(p => p.team === 1).length;
  const blueTeam = room.getPlayerList().filter(p => p.team === 2).length;
  return redTeam >= 4 && blueTeam >= 4;
}

// Announce match type
export function announceMatchType(): void {
  if (isRankedMatch()) {
    sendMessage(`⚔️ RANKED MATCH - ELO will be updated`);
  } else {
    sendMessage(`🎮 UNRANKED MATCH - Practice mode`);
  }
}

// Reset stats for new match
export function resetMatchStats(): void {
  matchStats.clear();
  lastKicker = null;
  secondLastKicker = null;
  lastKickTime = 0;
}

// Initialize all players currently in room
export function initAllPlayers(): void {
  room.getPlayerList().forEach(p => {
    if (p.id !== 0) { // Exclude host
      initPlayerStats(toAug(p));
    }
  });
}
