import { GAME_CONFIG } from "@udc/shared";

const corpse = GAME_CONFIG.colonists.corpse;

/**
 * Cuánto se ha hundido el cuerpo de un colono (#74) de `age` segundos (0 mientras está a la
 * vista), o `null` si ya no se ve y hay que quitarlo.
 */
export function corpseSink(age: number): number | null {
  if (age < corpse.seconds) return 0;
  const t = (age - corpse.seconds) / corpse.sinkSeconds;
  return t >= 1 ? null : t * corpse.sinkDepth;
}
