import { useState } from 'react';
import { Sparkles, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import type { RolePresetDefinition } from '../config/rolePermissionPresets';
import { ROLE_PERMISSION_PRESETS } from '../config/rolePermissionPresets';
import type { TenantModule } from '@/core/tenant/tenantEntitlements';
import { Modal } from '@/shared/components/common/Modal';
import { Button } from '@/shared/components/common/Button';
import { cn } from '@/shared/utils/cn';

interface PresetApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleName: string;
  hasCustomizations: boolean;
  enabledModules: readonly TenantModule[];
  onApplyPreset: (preset: RolePresetDefinition) => void;
}

export function PresetApplyModal({
  isOpen,
  onClose,
  roleName,
  hasCustomizations,
  enabledModules,
  onApplyPreset,
}: PresetApplyModalProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('sales_manager');
  const [showConfirmOverwrite, setShowConfirmOverwrite] = useState(false);

  const selectedPreset = ROLE_PERMISSION_PRESETS.find((p) => p.id === selectedPresetId) ?? ROLE_PERMISSION_PRESETS[0];

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
  };

  const handleApplyClick = () => {
    if (hasCustomizations) {
      setShowConfirmOverwrite(true);
    } else {
      executeApply();
    }
  };

  const executeApply = () => {
    onApplyPreset(selectedPreset);
    setShowConfirmOverwrite(false);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !showConfirmOverwrite}
        onClose={onClose}
        title="Apply Role Permission Preset"
        maxWidth="640px"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
            <Sparkles className="size-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold">Predefined Enterprise Role Presets</p>
              <p className="mt-0.5 text-blue-800">
                Choose a role preset to automatically configure recommended sidebar page access. Presets strictly respect modules enabled for your company by Super Admin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {ROLE_PERMISSION_PRESETS.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              const permissionsCount = preset.resolvePermissions(enabledModules).length;

              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3.5 text-left cursor-pointer transition-all select-none',
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-transparent',
                    )}
                  >
                    <Check size={12} strokeWidth={3} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{preset.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {preset.category}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                        {permissionsCount} permissions
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{preset.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-xs text-slate-500">
              Target role: <strong className="text-slate-800">{roleName}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" leftIcon={<Sparkles size={14} />} onClick={handleApplyClick}>
                Apply Preset
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Overwrite Confirmation Dialog */}
      <Modal
        isOpen={showConfirmOverwrite}
        onClose={() => setShowConfirmOverwrite(false)}
        title="Confirm Overwrite Role Permissions"
        maxWidth="480px"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-950">Overwrite Existing Permissions?</p>
              <p className="mt-1 text-amber-900">
                Role &quot;<strong>{roleName}</strong>&quot; has customized permissions. Applying the &quot;
                <strong>{selectedPreset.name}</strong>&quot; preset will replace current selections in your working editor.
              </p>
              <p className="mt-1 text-amber-800">
                You can review, tweak, and save or discard these changes before committing.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowConfirmOverwrite(false)}>
              Keep Existing
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<ShieldCheck size={14} />}
              onClick={executeApply}
            >
              Confirm & Apply Preset
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
