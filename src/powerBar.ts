import { room, Game, PlayerAugmented, toAug } from "../index";
import { mapBounds, defaults } from "./settings";

// Power Bar Configuration
const POWER_BAR_CONFIG = {
  levels: 5,
  colors: [
    0x00FF00, // Green - Level 1 (weakest)
    0x7FFF00, // Light Green - Level 2
    0xFFFF00, // Yellow - Level 3
    0xFF7F00, // Orange - Level 4
    0xFF0000  // Red - Level 5 (strongest)
  ],
  multipliers: [1.0, 1.15, 1.3, 1.45, 1.65], // Reduced power multipliers for more realistic speeds
  discRadius: 4, // Smaller disc size to match the image
  discSpacing: 8.5, // Very close spacing like in the image
  distanceFromBall: 25, // Closer to ball
  fillSpeed: 0.015, // Slower fill speed
  detectionRadius: 30 // Optimal - shows when player is reasonably close
};

// Disc IDs for power bar (using unused disc slots)
export const powerBarDiscIds = [30, 31, 32, 33, 34];

export class PowerBar {
  private game: Game;
  private isActive: boolean = false;
  private currentLevel: number = 0;
  private fillProgress: number = 0;
  private lastPlayerNearBall: PlayerAugmented | null = null;
  private filling: boolean = false;
  private lastUpdateTime: number = 0;
  private frameSkip: number = 0;
  private lastBallPos: { x: number; y: number } | null = null;
  private cachedPlayers: PlayerObject[] = [];
  private lastPlayerCacheTime: number = 0;
  private firstShowUpdateDone: boolean = false; // Prevent double update on first show
  private discStates: boolean[] = [false, false, false, false, false]; // Track disc fill state

  constructor(game: Game) {
    this.game = game;
    this.hide();
  }

  // Check if any player is near the ball during set piece
  public checkActivation(isSetPiece: boolean): void {
    if (!isSetPiece || this.game.inPlay) {
      if (this.isActive) {
        this.hide();
      }
      return;
    }

    // Skip frames for performance - balanced for responsiveness and performance
    this.frameSkip++;
    if (this.frameSkip < 8) return; // Check every ~133ms for better responsiveness
    this.frameSkip = 0;

    const ball = room.getDiscProperties(0);
    if (!ball) return;

    // Cache players list every 500ms to reduce overhead
    const now = Date.now();
    if (now - this.lastPlayerCacheTime > 500) {
      this.cachedPlayers = room.getPlayerList().filter(p => p.team !== 0);
      this.lastPlayerCacheTime = now;
    }

    let closestPlayer: PlayerAugmented | null = null;
    let closestDistanceSquared = POWER_BAR_CONFIG.detectionRadius * POWER_BAR_CONFIG.detectionRadius;

    // Find closest player to ball (using squared distance to avoid sqrt)
    for (const player of this.cachedPlayers) {
      const props = room.getPlayerDiscProperties(player.id);
      if (!props) continue;

      const dx = props.x - ball.x;
      const dy = props.y - ball.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared < closestDistanceSquared) {
        closestDistanceSquared = distanceSquared;
        closestPlayer = toAug(player);
      }
    }

    if (closestPlayer) {
      if (!this.isActive) {
        this.show(ball.x, ball.y);
        this.fillProgress = 0; // Reset progress when showing
      }
      this.lastPlayerNearBall = closestPlayer;
      this.filling = true;
    } else {
      // Player moved away - hide immediately
      if (this.isActive) {
        this.hide();
        this.fillProgress = 0; // Reset progress when hiding
        this.filling = false;
      }
    }
  }

  // Update power bar fill level
  public update(): void {
    if (!this.isActive || !this.filling) return;

    // Increase fill progress
    this.fillProgress = Math.min(1, this.fillProgress + POWER_BAR_CONFIG.fillSpeed);
    
    // Calculate current level (0-4)
    const newLevel = Math.floor(this.fillProgress * POWER_BAR_CONFIG.levels);
    
    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
    }
    
    this.updateDisplay();
  }

  // Update visual display of power bar
  private updateDisplay(): void {
    if (!this.isActive) return;
    
    // Skip first update in same tick as show() to prevent lag
    if (!this.firstShowUpdateDone) {
      this.firstShowUpdateDone = true;
      return;
    }

    const ball = room.getDiscProperties(0);
    if (!ball) return;

    // Calculate how many discs should be filled
    const filledLevels = Math.ceil(this.fillProgress * POWER_BAR_CONFIG.levels);
    
    // Only update if ball moved significantly (>5 pixels) or level changed
    if (this.lastBallPos) {
      const dx = Math.abs(ball.x - this.lastBallPos.x);
      const dy = Math.abs(ball.y - this.lastBallPos.y);
      
      // Skip if ball hasn't moved much and level is same
      if (dx < 5 && dy < 5 && this.currentLevel === filledLevels) {
        return;
      }
    }
    
    // Only update discs that actually changed state to minimize operations
    const levelChanged = this.currentLevel !== filledLevels;
    this.currentLevel = filledLevels;
    
    // Check if we need to update positions (before updating lastBallPos)
    const ballMoved = this.lastBallPos ? 
      (Math.abs(ball.x - this.lastBallPos.x) > 5 || Math.abs(ball.y - this.lastBallPos.y) > 5) : true;
    
    this.lastBallPos = { x: ball.x, y: ball.y };
    
    // Update discs efficiently
    for (let i = 0; i < POWER_BAR_CONFIG.levels; i++) {
      const discId = powerBarDiscIds[i];
      const shouldBeFilled = i < filledLevels;
      
      // Only update disc if its state changed
      if (levelChanged && this.discStates[i] !== shouldBeFilled) {
        this.discStates[i] = shouldBeFilled;
        const color = shouldBeFilled ? POWER_BAR_CONFIG.colors[i] : 0x222222;
        const x = ball.x + POWER_BAR_CONFIG.distanceFromBall + (i * POWER_BAR_CONFIG.discSpacing);
        const y = ball.y;
        
        // Update with all properties when state changes
        room.setDiscProperties(discId, {
          x: x,
          y: y,
          radius: POWER_BAR_CONFIG.discRadius,
          color: color,
          cMask: 0,
          cGroup: 0
        });
      } else if (ballMoved && !levelChanged) {
        // Only update position if ball moved significantly and level didn't change
        const x = ball.x + POWER_BAR_CONFIG.distanceFromBall + (i * POWER_BAR_CONFIG.discSpacing);
        const y = ball.y;
        
        room.setDiscProperties(discId, {
          x: x,
          y: y
        });
      }
    }
  }

  // Show power bar
  private show(ballX: number, ballY: number): void {
    this.isActive = true;
    this.fillProgress = 0;
    this.currentLevel = 0;
    this.lastBallPos = { x: ballX, y: ballY };
    this.firstShowUpdateDone = false; // Reset for next show
    this.discStates = [false, false, false, false, false]; // Reset disc states
    
    // Initialize all discs as empty (dark gray) with zero velocity
    for (let i = 0; i < POWER_BAR_CONFIG.levels; i++) {
      const x = ballX + POWER_BAR_CONFIG.distanceFromBall + (i * POWER_BAR_CONFIG.discSpacing);
      const y = ballY;
      
      room.setDiscProperties(powerBarDiscIds[i], {
        x: x,
        y: y,
        xspeed: 0, // Prevent physics calculation
        yspeed: 0, // Prevent physics calculation
        radius: POWER_BAR_CONFIG.discRadius,
        color: 0x222222, // Dark gray for unfilled
        cMask: 0,
        cGroup: 0,
        invMass: 0
      });
    }
    
    // Delay first update to avoid frame drop in same tick
    setTimeout(() => {
      if (this.isActive) {
        this.updateDisplay();
      }
    }, 10);
  }

  // Hide power bar
  public hide(): void {
    this.isActive = false;
    this.fillProgress = 0;
    this.currentLevel = 0;
    this.filling = false;
    this.lastPlayerNearBall = null;
    this.lastBallPos = null;
    this.firstShowUpdateDone = false;
    this.discStates = [false, false, false, false, false];
    
    // Move all discs off screen with minimal properties to avoid lag
    for (let i = 0; i < POWER_BAR_CONFIG.levels; i++) {
      room.setDiscProperties(powerBarDiscIds[i], {
        x: 3000,
        y: 3000,
        radius: 0
      });
    }
  }

  // Get power multiplier based on current fill level
  public getPowerMultiplier(): number {
    if (!this.isActive || this.fillProgress <= 0) return 1.0;
    
    // Get the actual filled level (0 to 4)
    const level = Math.max(0, Math.ceil(this.fillProgress * POWER_BAR_CONFIG.levels) - 1);
    return POWER_BAR_CONFIG.multipliers[Math.min(level, POWER_BAR_CONFIG.levels - 1)];
  }

  // Apply power to ball when kicked
  public applyPower(player: PlayerAugmented): void {
    if (!this.isActive || !this.lastPlayerNearBall) return;
    if (this.lastPlayerNearBall.id !== player.id) return;

    const multiplier = this.getPowerMultiplier();
    const filledLevels = Math.ceil(this.fillProgress * POWER_BAR_CONFIG.levels);
    
    if (multiplier > 1.0 && filledLevels > 0) {
      const ball = room.getDiscProperties(0);
      if (ball) {
        // Apply velocity boost based on power level
        const boostFactor = multiplier;
        
        // Get current ball speed and apply multiplier
        setTimeout(() => {
          const newBall = room.getDiscProperties(0);
          if (newBall && (Math.abs(newBall.xspeed) > 0.1 || Math.abs(newBall.yspeed) > 0.1)) {
            room.setDiscProperties(0, {
              xspeed: newBall.xspeed * boostFactor,
              yspeed: newBall.yspeed * boostFactor
            });
            
            // Visual feedback - flash ball color based on power level
            const colorIndex = Math.max(0, filledLevels - 1);
            if (colorIndex >= 0 && colorIndex < POWER_BAR_CONFIG.colors.length) {
              room.setDiscProperties(0, { color: POWER_BAR_CONFIG.colors[colorIndex] });
              setTimeout(() => {
                room.setDiscProperties(0, { color: 0xFFFFFF });
              }, 500);
            }
          }
        }, 50); // Small delay to let the kick register first
      }
    }
    
    // Hide power bar after kick
    this.hide();
  }

  // Check if power bar is active
  public getIsActive(): boolean {
    return this.isActive;
  }

  // Get current fill level (0-1)
  public getFillLevel(): number {
    return this.fillProgress;
  }
}
