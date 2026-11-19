import { useEffect, useState, useCallback } from 'react';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Card } from '@/shared/components/common/Card';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { Button } from '@/shared/components/common/Button';
import {
  RefreshCw,
  Server,
  Database,
  Cpu,
  Globe,
  HardDrive,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  checkLivePlatformHealth,
  formatUptime,
  type PlatformHealthSnapshot,
  type LiveHealthServiceStatus,
} from '@/features/platform/services/platformHealthService';

function getServiceIcon(category: LiveHealthServiceStatus['category']) {
  switch (category) {
    case 'frontend':
      return <Globe className="h-5 w-5 text-blue-600" />;
    case 'backend':
      return <Server className="h-5 w-5 text-purple-600" />;
    case 'database':
      return <Database className="h-5 w-5 text-indigo-600" />;
    case 'memory':
      return <Cpu className="h-5 w-5 text-emerald-600" />;
    case 'storage':
      return <HardDrive className="h-5 w-5 text-amber-600" />;
    default:
      return <Activity className="h-5 w-5 text-slate-600" />;
  }
}

export function PlatformHealthPage() {
  const [snapshot, setSnapshot] = useState<PlatformHealthSnapshot | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await checkLivePlatformHealth();
      setSnapshot(result);
    } catch {
      // Fallback
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      void runCheck();
    }, 30000);
    return () => clearInterval(interval);
  }, [runCheck]);

  const overallStatus = snapshot?.overallStatus ?? 'operational';

  return (
    <PageContainer>
      <PageHeader
        title="Platform Health"
        description="Live operational telemetry and connectivity monitoring for Frontend, Spring Boot API, PostgreSQL, and storage."
        actions={
          <Button
            leftIcon={<RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />}
            onClick={() => void runCheck()}
            isLoading={isChecking}
          >
            Run Health Check
          </Button>
        }
      />

      {/* Overall Health Status Banner */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                overallStatus === 'operational'
                  ? 'bg-emerald-100 text-emerald-700'
                  : overallStatus === 'degraded'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {overallStatus === 'operational' ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : overallStatus === 'degraded' ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <XCircle className="h-6 w-6" />
              )}
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {overallStatus === 'operational'
                  ? 'All Systems Operational'
                  : overallStatus === 'degraded'
                    ? 'Some Platform Services Degraded'
                    : 'Critical Services Offline'}
              </h2>
              <p className="text-xs text-slate-500">
                Real-time telemetry gathered from browser runtime and backend API endpoints.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            {snapshot?.uptimeSeconds !== undefined && (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 font-medium border border-slate-200">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>Backend Uptime: </span>
                <strong className="text-slate-800">{formatUptime(snapshot.uptimeSeconds)}</strong>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Overall Status:</span>
              <StatusBadge status={overallStatus} />
            </div>
          </div>
        </div>
      </Card>

      {/* Services Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {(snapshot?.services ?? []).map((service) => (
          <Card key={service.id} className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                    {getServiceIcon(service.category)}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{service.service}</h3>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">
                      {service.category}
                    </span>
                  </div>
                </div>
                <StatusBadge status={service.status} />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-600">{service.note}</p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              <span>
                {service.latencyMs > 0 ? (
                  <span className="font-medium text-slate-700">Latency: {service.latencyMs} ms</span>
                ) : (
                  <span>Latency: —</span>
                )}
              </span>
              <span>Checked {new Date(service.checkedAt).toLocaleTimeString()}</span>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
