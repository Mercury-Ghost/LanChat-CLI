import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CertificateOptions {
  days?: number;
  commonName?: string;
  organization?: string;
  country?: string;
  state?: string;
  locality?: string;
}

export async function ensureCertificate(certDir: string): Promise<void> {
  const certPath = path.join(certDir, 'server.crt');
  const keyPath = path.join(certDir, 'server.key');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return;
  }

  await fs.promises.mkdir(certDir, { recursive: true });

  const hasOpenSSL = await checkOpenSSL();
  
  if (hasOpenSSL) {
    await generateWithOpenSSL(certPath, keyPath);
  } else {
    throw new Error(
      'OpenSSL not found. Please install OpenSSL to generate TLS certificates. ' +
      'Alternatively, you can manually place server.crt and server.key in the certs directory.'
    );
  }
}

async function checkOpenSSL(): Promise<boolean> {
  try {
    await execAsync('openssl version');
    return true;
  } catch {
    return false;
  }
}

async function generateWithOpenSSL(certPath: string, keyPath: string): Promise<void> {
  const cmd = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=LanChat Server/O=LanChat/C=CN"`;
  await execAsync(cmd);
}

export function getCertificateFingerprint(certPath: string): string {
  const cert = fs.readFileSync(certPath);
  const fingerprint = crypto.createHash('sha256').update(cert).digest('hex');
  return fingerprint.toUpperCase().match(/.{2}/g)?.join(':') || fingerprint;
}

export async function verifyCertificate(certPath: string): Promise<boolean> {
  try {
    const cert = fs.readFileSync(certPath);
    const x509 = new crypto.X509Certificate(cert);
    const notAfter = new Date(x509.validTo);
    return notAfter > new Date();
  } catch {
    return false;
  }
}
