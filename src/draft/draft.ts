import { sendMessage } from "../message";
import { toAug, PlayerAugmented } from "../..";

interface DraftCandidate {
  id: number;
  auth: string;
  name: string;
  elo: number;
}

interface DraftCaptain extends DraftCandidate {
  team: TeamID;
}

interface DraftState {
  room: RoomObject;
  captains: DraftCaptain[];
  available: DraftCandidate[];
  teams: {
    red: DraftCandidate[];
    blue: DraftCandidate[];
  };
  sequence: TeamID[];
  sequenceIndex: number;
  pendingResolve?: (candidate: DraftCandidate | null) => void;
  pendingTimeout?: NodeJS.Timeout;
  timeoutMs: number;
  resolve: (result: { red: PlayerObject[]; blue: PlayerObject[] } | null) => void;
  afkHandler?: Function;
}

let draftState: DraftState | null = null;

const teamKey = (team: TeamID) => (team === 1 ? "red" : "blue");

const candidateFromPlayer = (player: PlayerObject): DraftCandidate | null => {
  try {
    const aug = toAug(player);
    return {
      id: player.id,
      auth: aug.auth,
      name: player.name,
      elo: aug.elo,
    };
  } catch {
    return null;
  }
};

const getCaptain = (state: DraftState, team: TeamID) =>
  state.captains.find((c) => c.team === team) ?? null;

const purgeMissingCandidates = (state: DraftState) => {
  state.available = state.available.filter((candidate) =>
    state.room.getPlayer(candidate.id),
  );
};

const announcePlayers = (state: DraftState) => {
  purgeMissingCandidates(state);
  if (state.available.length === 0) {
    return;
  }
  sendMessage("Available players:");
  state.available.forEach((candidate, index) => {
    sendMessage(`${index + 1}. ${candidate.name} (${candidate.elo})`);
  });
};

const shiftNextAvailable = (state: DraftState): DraftCandidate | null => {
  while (state.available.length > 0) {
    const candidate = state.available.shift()!;
    if (state.room.getPlayer(candidate.id)) {
      return candidate;
    }
  }
  return null;
};

const collectTeamPlayers = (state: DraftState, team: TeamID) => {
  const key = teamKey(team);
  return state.teams[key]
    .map((candidate) => state.room.getPlayer(candidate.id))
    .filter((p): p is PlayerObject => !!p);
};

const finalizeDraft = (state: DraftState, cancelled: boolean) => {
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
  sendMessage("Draft finished.");
  draftState = null;
  state.resolve({ red: redPlayers, blue: bluePlayers });
};

const assignCandidate = (
  state: DraftState,
  team: TeamID,
  candidate: DraftCandidate,
) => {
  const player = state.room.getPlayer(candidate.id);
  if (!player) {
    sendMessage(`${candidate.name} is no longer in the room. Pick again.`);
    return false;
  }
  const key = teamKey(team);
  state.teams[key].push(candidate);
  state.room.setPlayerTeam(candidate.id, team);
  sendMessage(
    `${candidate.name} (${candidate.elo}) joined ${
      team === 1 ? "🔴 Red" : "🔵 Blue"
    } team.`,
  );
  return true;
};

const waitForPick = (state: DraftState, team: TeamID) =>
  new Promise<DraftCandidate | null>((resolve) => {
    purgeMissingCandidates(state);
    if (state.available.length === 0) {
      resolve(null);
      return;
    }
    const captain = getCaptain(state, team);
    const captainPlayer = captain ? state.room.getPlayer(captain.id) : null;
    if (!captain || !captainPlayer) {
      sendMessage("Draft cancelled because a captain left.");
      finalizeDraft(state, true);
      resolve(null);
      return;
    }
    sendMessage(
      `It's your turn to pick. Use !pick <number> within ${
        state.timeoutMs / 1000
      }s.`,
      captainPlayer,
    );
    announcePlayers(state);
    state.pendingResolve = (candidate) => resolve(candidate);
    state.pendingTimeout = setTimeout(() => {
      state.pendingTimeout = undefined;
      state.pendingResolve = undefined;
      const autoCandidate = shiftNextAvailable(state);
      if (autoCandidate) {
        sendMessage(
          `${autoCandidate.name} auto-picked for ${
            team === 1 ? "🔴 Red" : "🔵 Blue"
          } team.`,
        );
      }
      resolve(autoCandidate);
    }, state.timeoutMs);
  });

const runDraft = async (state: DraftState) => {
  for (state.sequenceIndex = 0; state.sequenceIndex < state.sequence.length; ) {
    if (draftState !== state) {
      return;
    }
    if (state.available.length === 0) {
      break;
    }
    const team = state.sequence[state.sequenceIndex];
    const candidate = await waitForPick(state, team);
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
};

export const performDraft = async (
  room: RoomObject,
  players: PlayerObject[],
  maxTeamSize: number,
  afkHandler?: Function,
) => {
  if (draftState) {
    sendMessage("Draft is already running.");
    return null;
  }
  room.stopGame();
  const livePlayers = players
    .map((p) => room.getPlayer(p.id))
    .filter((p): p is PlayerObject => !!p);
  const sorted = [...livePlayers].sort((a, b) => toAug(b).elo - toAug(a).elo);
  if (sorted.length < 2) {
    sendMessage("Not enough players for draft.");
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
    sendMessage("Unable to determine captains.");
    return null;
  }
  room.setPlayerTeam(redCaptain.id, 1);
  room.setPlayerTeam(blueCaptain.id, 2);
  const remaining = participants
    .slice(2)
    .map((p) => candidateFromPlayer(p))
    .filter((c): c is DraftCandidate => !!c);
  const picksCapacity = Math.max(maxTeamSize * 2 - 2, 0);
  const available = remaining.slice(0, picksCapacity);
  const overflow = remaining.slice(picksCapacity);
  overflow.forEach((candidate) => {
    const player = room.getPlayer(candidate.id);
    if (player && afkHandler) {
      afkHandler(player);
    }
  });
  sendMessage(
    `Draft started. Captains: 🔴 ${redCaptain.name} vs 🔵 ${blueCaptain.name}.`,
  );
  sendMessage("Use !pick <number> to choose teammates. 20 seconds per pick.");
  const sequence: TeamID[] = [];
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
    } else {
      if (sequence.length < totalPicks) {
        sequence.push(2);
      }
      if (sequence.length < totalPicks) {
        sequence.push(1);
      }
    }
    round += 1;
  }
  return await new Promise<{ red: PlayerObject[]; blue: PlayerObject[] } | null>(
    (resolve) => {
      draftState = {
        room,
        captains: [
          { ...redCaptain, team: 1 },
          { ...blueCaptain, team: 2 },
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
    },
  );
};

export const handleDraftPick = (
  player: PlayerAugmented,
  selection: number,
) => {
  const state = draftState;
  if (!state || state.pendingResolve === undefined) {
    sendMessage("There is no pick pending right now.", player);
    return;
  }
  const team = state.sequence[state.sequenceIndex];
  const captain = getCaptain(state, team);
  if (!captain || captain.id !== player.id) {
    sendMessage("You are not the captain picking now.", player);
    return;
  }
  if (!Number.isInteger(selection) || selection < 1) {
    sendMessage("Invalid pick number.", player);
    return;
  }
  if (selection > state.available.length) {
    sendMessage("Pick number is out of range.", player);
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

export const isDraftRunning = () => draftState !== null;
