import { decodeMessage, encodeMessage, type ClientMessage, type ServerMessage } from "@udc/shared";

export type MessageHandler = (msg: ServerMessage) => void;

/** Envoltorio fino sobre WebSocket con medición de latencia y ancho de banda. */
export class Connection {
  private socket: WebSocket | null = null;
  private pingTimer: number | undefined;

  /** Latencia de ida y vuelta suavizada, en ms. */
  rtt = 0;
  /** Bytes recibidos desde la última lectura de `takeBytesReceived`. */
  private bytesReceived = 0;

  constructor(
    private readonly url: string,
    private readonly onMessage: MessageHandler,
    private readonly onClose: (reason: string) => void,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      socket.binaryType = "arraybuffer";
      this.socket = socket;

      let opened = false;
      socket.onopen = () => {
        opened = true;
        this.pingTimer = window.setInterval(
          () => this.send({ t: "ping", time: performance.now() }),
          1000,
        );
        resolve();
      };

      socket.onerror = () =>
        reject(new Error(`No se puede conectar con el servidor (${this.url}).`));

      socket.onclose = () => {
        window.clearInterval(this.pingTimer);
        if (opened)
          this.onClose("Se ha perdido la conexión con el servidor. Recarga la página para volver.");
      };

      socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        this.bytesReceived += event.data.byteLength;
        const msg = decodeMessage<ServerMessage>(event.data);
        if (msg.t === "pong") {
          const sample = performance.now() - msg.time;
          this.rtt = this.rtt === 0 ? sample : this.rtt * 0.8 + sample * 0.2;
          return;
        }
        this.onMessage(msg);
      };
    });
  }

  send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(encodeMessage(msg));
  }

  takeBytesReceived(): number {
    const b = this.bytesReceived;
    this.bytesReceived = 0;
    return b;
  }
}
