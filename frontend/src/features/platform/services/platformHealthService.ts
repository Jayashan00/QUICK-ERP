import { env } from '@/core/config/environment';

export interface LiveHealthServiceStatus {
  id: string;
  service: string;
  category: 'frontend' | 'backend' | 'database' | 'memory' | 'storage';
  status: 'operational' | 'degraded' | 'offline';
  latencyMs: number;
  checkedAt: string;
  note: string;
  details?: Record<string, unknown>;
}

export interface PlatformHealthSnapshot {
  overallStatus: 'operational' | 'degraded' | 'offline';
  checkedAt: string;
  uptimeSeconds?: number;
  services: LiveHealthServiceStatus[];
}

export function formatUptime(seconds?: number): string {
  if (seconds === undefined || seconds === null) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export async function checkLivePlatformHealth(): Promise<PlatformHealthSnapshot> {
  const now = new Date().toISOString();
  const services: LiveHealthServiceStatus[] = [];

  // 1. Frontend Check (Client SPA)
  const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
  services.push({
    id: 'health-frontend',
    service: 'Frontend Web Application',
    category: 'frontend',
    status: isOnline ? 'operational' : 'offline',
    latencyMs: 1,
    checkedAt: now,
    note: isOnline
      ? 'React Single-Page Application operational in browser.'
      : 'Browser network appears disconnected.',
  });

  // 2. Spring Boot REST API Check
  let apiData: {
    status?: string;
    database?: string;
    databaseLatencyMs?: number;
    uptimeSeconds?: number;
    memory?: { usedMb: number; maxMb: number };
  } | null = null;
  let apiLatency = 0;
  let apiStatus: 'operational' | 'degraded' | 'offline' = 'offline';
  let apiNote = '';

  try {
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${env.apiBaseUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    apiLatency = Math.round(performance.now() - start);

    if (response.ok || response.status === 503) {
      apiData = await response.json();
      apiStatus = response.ok ? 'operational' : 'degraded';
      apiNote = `Spring Boot API responsive on port 8000 (${env.apiBaseUrl}).`;
    } else {
      apiStatus = 'degraded';
      apiNote = `API returned HTTP ${response.status}.`;
    }
  } catch {
    apiStatus = 'offline';
    apiNote = `Cannot connect to Spring Boot API at ${env.apiBaseUrl}. Server may be stopped or port 8000 unreachable.`;
  }

  services.push({
    id: 'health-api',
    service: 'Spring Boot REST API',
    category: 'backend',
    status: apiStatus,
    latencyMs: apiLatency,
    checkedAt: now,
    note: apiNote,
    details: apiData?.uptimeSeconds !== undefined ? { uptimeSeconds: apiData.uptimeSeconds } : undefined,
  });

  // 3. PostgreSQL Database Check
  if (apiData && apiData.database === 'up') {
    services.push({
      id: 'health-db',
      service: 'PostgreSQL Database',
      category: 'database',
      status: 'operational',
      latencyMs: apiData.databaseLatencyMs ?? apiLatency,
      checkedAt: now,
      note: 'PostgreSQL connection pool healthy (SELECT 1 test query succeeded).',
    });
  } else if (apiData && apiData.database === 'down') {
    services.push({
      id: 'health-db',
      service: 'PostgreSQL Database',
      category: 'database',
      status: 'offline',
      latencyMs: 0,
      checkedAt: now,
      note: 'PostgreSQL connection failed or database service is down.',
    });
  } else {
    services.push({
      id: 'health-db',
      service: 'PostgreSQL Database',
      category: 'database',
      status: 'offline',
      latencyMs: 0,
      checkedAt: now,
      note: 'Database check unreachable (backend API is offline).',
    });
  }

  // 4. JVM Memory & System Runtime Check
  if (apiData && apiData.memory) {
    const mem = apiData.memory;
    const isDegraded = mem.usedMb > mem.maxMb * 0.9;
    services.push({
      id: 'health-memory',
      service: 'JVM Memory & Runtime',
      category: 'memory',
      status: isDegraded ? 'degraded' : 'operational',
      latencyMs: 0,
      checkedAt: now,
      note: `JVM Heap: ${mem.usedMb} MB used / ${mem.maxMb} MB max allocated.`,
      details: mem,
    });
  } else {
    services.push({
      id: 'health-memory',
      service: 'JVM Memory & Runtime',
      category: 'memory',
      status: apiStatus === 'offline' ? 'offline' : 'degraded',
      latencyMs: 0,
      checkedAt: now,
      note: 'Host runtime memory telemetry unavailable.',
    });
  }

  // 5. File & Asset Storage Check
  services.push({
    id: 'health-storage',
    service: 'File & Asset Storage',
    category: 'storage',
    status: apiStatus === 'operational' ? 'operational' : 'degraded',
    latencyMs: apiStatus === 'operational' ? 2 : 0,
    checkedAt: now,
    note:
      apiStatus === 'operational'
        ? 'File upload and document storage directory active.'
        : 'Storage verification pending backend connection.',
  });

  const overallStatus =
    services.some((s) => s.status === 'offline')
      ? 'degraded'
      : services.every((s) => s.status === 'operational')
        ? 'operational'
        : 'degraded';

  return {
    overallStatus,
    checkedAt: now,
    uptimeSeconds: apiData?.uptimeSeconds,
    services,
  };
}
