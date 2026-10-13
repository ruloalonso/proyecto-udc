#!/bin/sh
# Actualiza el juego en el NAS (E7-6): baja el código de GitHub (sin git), reconstruye la imagen
# y lo arranca. Si el túnel estaba en marcha, lo vuelve a levantar e imprime su dirección (la
# del túnel rápido cambia cada vez que arranca).
#
#   sh actualizar.sh              la rama main
#   sh actualizar.sh h5/mi-rama   otra rama, para probarla antes de fusionarla
#
# Todo va dentro de una función: el tar sobrescribe este mismo archivo mientras se ejecuta, y
# así el intérprete ya lo ha leído entero.

main() {
  set -eu
  branch="${1:-main}"
  cd "$(dirname "$0")"

  # El túnel comparte la red del juego: al recrear el juego hay que recrearlo a él también.
  tunnel=""
  if [ -n "$(docker compose ps -q tunnel 2>/dev/null)" ]; then tunnel="--profile tunnel"; fi

  # Los resúmenes de las partidas (E7-8), a partidas.jsonl antes de nada: al recrear el
  # contenedor se pierden sus registros. Sin repetir los que ya estaban (si no se recrea, los
  # registros siguen ahí y volverían a salir).
  if [ -n "$(docker compose ps -q udc 2>/dev/null)" ]; then
    touch partidas.jsonl
    { cat partidas.jsonl; docker compose logs --no-log-prefix udc 2>/dev/null |
      sed -n 's/^  JSON //p'; } | awk '!seen[$0]++' > partidas.jsonl.new
    mv partidas.jsonl.new partidas.jsonl
    echo "Resúmenes de partidas guardados: $(wc -l < partidas.jsonl | tr -d ' ') en partidas.jsonl"
  fi

  # Primero el archivo y luego el tar: en una tubería, un 404 de curl no pararía el script (manda
  # el estado de tar, que acaba bien sin nada que descomprimir) y se reconstruiría lo de antes.
  echo "Bajando ${branch}…"
  archive="/tmp/udc-$$.tar.gz"
  trap 'rm -f "$archive"' EXIT
  curl -fsSL -o "$archive" "https://github.com/ruloalonso/proyecto-udc/archive/refs/heads/$branch.tar.gz"
  tar xzf "$archive" --strip-components=1

  echo "Construyendo y arrancando (la primera vez tarda unos minutos)…"
  # shellcheck disable=SC2086 # $tunnel vacío o con dos palabras, a propósito.
  docker compose $tunnel up -d --build
  # Las imágenes viejas que deja cada construcción, fuera: el disco del NAS no es infinito.
  docker image prune -f >/dev/null

  docker compose ps
  if [ -n "$tunnel" ]; then
    echo "Esperando la dirección del túnel…"
    sleep 8
    docker compose logs tunnel 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
  fi
  echo "Hecho: ${branch} en http://<nas>:8090. Registros: docker compose logs -f udc"
}

main "$@"
exit
