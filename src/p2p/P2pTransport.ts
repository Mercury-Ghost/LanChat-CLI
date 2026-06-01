import { BaseTransport } from '../client/Transport';

export class P2pTransport extends BaseTransport {
  private peerId: string = '';
  private connectedPeers: Map<string, unknown> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async connect(host: string, port: number): Promise<void> {
    throw new Error('P2P 连接暂未实现');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  send(data: Buffer): void {
    if (!this.isConnected()) {
      throw new Error('未连接到任何对等节点');
    }
  }

  close(): void {
    this.connectedPeers.clear();
    this.isSocketConnected = false;
  }

  async discoverPeers(): Promise<string[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async connectToPeer(peerId: string): Promise<void> {
    throw new Error('P2P 连接暂未实现');
  }

  disconnectFromPeer(peerId: string): void {
    this.connectedPeers.delete(peerId);
  }

  broadcast(data: Buffer): void {
    this.send(data);
  }

  getPeerId(): string {
    return this.peerId;
  }

  getRemoteFingerprint(): string {
    return '';
  }

  getConnectedPeers(): string[] {
    return Array.from(this.connectedPeers.keys());
  }
}
