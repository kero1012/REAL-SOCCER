import { db, Game, holdPlayer } from "..";

const k = 30;
const MIN_PLAYERS_PER_TEAM = 4;
const MIN_CHANGE = 1;

const getp1 = (elo: number, enemyTeamElo: number) =>
  1 / (1 + 10 ** ((elo - enemyTeamElo) / 400));

const getAvgElo = (playerListWithElo: { elo: number }[]): number => {
  if (playerListWithElo.length === 0) {
    throw "There are no players with elo in one of the teams.";
  }
  return (
    playerListWithElo.map((p) => p.elo).reduce((a, b) => a + b, 0) /
    playerListWithElo.length
  );
};

const ensurePlayerElo = async (player: holdPlayer) => {
  const result = await db.get("SELECT elo FROM players WHERE auth=?", [
    player.auth,
  ]);
  if (result && typeof result.elo === "number") {
    return result.elo as number;
  }
  await db.run(
    "INSERT OR IGNORE INTO players(auth, name, elo) VALUES(?, ?, 1200)",
    [player.auth, "", 1200],
  );
  const fallback = await db.get("SELECT elo FROM players WHERE auth=?", [
    player.auth,
  ]);
  return fallback && typeof fallback.elo === "number" ? fallback.elo : 1200;
};

export const changeElo = async (game: Game, winnerTeamId: TeamID) => {
  const holdPlayersWithElo: Array<holdPlayer & { elo: number }> = [];
  for (const holdPlayer of game.holdPlayers) {
    const elo = await ensurePlayerElo(holdPlayer);
    holdPlayersWithElo.push({ ...holdPlayer, elo });
  }

  const loserTeamId = winnerTeamId === 1 ? 2 : 1;
  const winners = holdPlayersWithElo.filter((p) => p.team === winnerTeamId);
  const losers = holdPlayersWithElo.filter((p) => p.team === loserTeamId);

  if (winners.length < MIN_PLAYERS_PER_TEAM || losers.length < MIN_PLAYERS_PER_TEAM) {
    return [];
  }

  const winnerTeamElo = getAvgElo(winners);
  const loserTeamElo = getAvgElo(losers);

  const changeLosers = losers.map((p) => {
    const p1 = getp1(p.elo, winnerTeamElo);
    const rawChange = Math.round(k * (1 - p1));
    const change = -Math.max(MIN_CHANGE, Math.abs(rawChange));
    if (Number.isNaN(change)) {
      throw "Change is not a number.";
    }
    return { id: p.id, auth: p.auth, change };
  });

  const changeWinners = winners.map((p) => {
    const p1 = getp1(p.elo, loserTeamElo);
    const rawChange = Math.round(k * p1);
    const change = Math.max(MIN_CHANGE, Math.abs(rawChange));
    if (Number.isNaN(change)) {
      throw "Change is not a number.";
    }
    return { id: p.id, auth: p.auth, change };
  });

  const changeList = [...changeWinners, ...changeLosers];
  for (const changeTuple of changeList) {
    await db.run(`UPDATE players SET elo=elo+? WHERE auth=?`, [
      changeTuple.change,
      changeTuple.auth,
    ]);
  }
  return changeList;
};
