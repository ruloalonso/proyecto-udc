/**
 * «Volver a filas» (E6-5): quién está listo para la siguiente partida. Lógica pura, con
 * cualquier clave para cada jugador (el servidor usa la sesión). La partida nueva empieza cuando
 * lo están todos los conectados; quien se va deja de contar.
 */
export class Rematch<K> {
  private readonly ready = new Set<K>();

  /** `key` ha pulsado «Volver a filas». */
  press(key: K): void {
    this.ready.add(key);
  }

  /** `key` se ha ido. */
  forget(key: K): void {
    this.ready.delete(key);
  }

  /** Partida nueva: todos vuelven a empezar sin pulsar. */
  clear(): void {
    this.ready.clear();
  }

  isReady(key: K): boolean {
    return this.ready.has(key);
  }

  /** Cuántos de `present` están listos. */
  count(present: Iterable<K>): number {
    let n = 0;
    for (const key of present) if (this.ready.has(key)) n++;
    return n;
  }

  /** ¿Están listos todos los de `present`? Sin nadie, no. */
  allReady(present: Iterable<K>): boolean {
    let any = false;
    for (const key of present) {
      if (!this.ready.has(key)) return false;
      any = true;
    }
    return any;
  }
}
