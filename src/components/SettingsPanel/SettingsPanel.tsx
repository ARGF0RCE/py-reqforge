import { useState, useCallback } from 'react';

interface Settings {
  includeHashes: boolean;
  customIndex: string;
  autoResolve: boolean;
  showDependencies: boolean;
  exportFormat: 'standard' | 'pinned' | 'loose';
}

interface SettingsPanelProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export default function SettingsPanel({
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customIndexInput, setCustomIndexInput] = useState(
    settings.customIndex
  );

  const handleSettingChange = useCallback(
    (key: keyof Settings, value: Settings[keyof Settings]) => {
      onSettingsChange({
        ...settings,
        [key]: value,
      });
    },
    [settings, onSettingsChange]
  );

  const handleCustomIndexSave = useCallback(() => {
    handleSettingChange('customIndex', customIndexInput);
  }, [customIndexInput, handleSettingChange]);

  const handleCustomIndexCancel = useCallback(() => {
    setCustomIndexInput(settings.customIndex);
  }, [settings.customIndex]);

  return (
    <div className="bg-gradient-settings p-6 rounded-lg">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-xl font-semibold text-white">Settings</h2>
        <span className="text-blue-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-white font-medium">Include Hashes</label>
                <p className="text-sm text-blue-200">
                  Generate SHA256 hashes for packages
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.includeHashes}
                  onChange={e =>
                    handleSettingChange('includeHashes', e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-white font-medium">
                  Auto-resolve Dependencies
                </label>
                <p className="text-sm text-blue-200">
                  Automatically add required dependencies
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoResolve}
                  onChange={e =>
                    handleSettingChange('autoResolve', e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-white font-medium">
                  Show Dependencies
                </label>
                <p className="text-sm text-blue-200">
                  Display dependency packages in list
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showDependencies}
                  onChange={e =>
                    handleSettingChange('showDependencies', e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="text-white font-medium block mb-2">
                Export Format
              </label>
              <select
                value={settings.exportFormat}
                onChange={e =>
                  handleSettingChange(
                    'exportFormat',
                    e.target.value as Settings['exportFormat']
                  )
                }
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="standard" className="bg-gray-800">
                  Standard (package==version)
                </option>
                <option value="pinned" className="bg-gray-800">
                  Pinned (package{'>'}=version)
                </option>
                <option value="loose" className="bg-gray-800">
                  Loose (package)
                </option>
              </select>
              <p className="text-sm text-blue-200 mt-1">
                Choose how version constraints are formatted
              </p>
            </div>

            <div>
              <label className="text-white font-medium block mb-2">
                Custom Package Index
              </label>
              <div className="space-y-2">
                <input
                  type="url"
                  value={customIndexInput}
                  onChange={e => setCustomIndexInput(e.target.value)}
                  placeholder="https://your-private-pypi.com/simple/"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />

                {customIndexInput !== settings.customIndex && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCustomIndexSave}
                      className="px-3 py-1 bg-green-500/20 text-green-200 rounded hover:bg-green-500/30 transition-colors text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCustomIndexCancel}
                      className="px-3 py-1 bg-gray-500/20 text-gray-200 rounded hover:bg-gray-500/30 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-blue-200 mt-1">
                URL for private package repository
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/20">
            <h3 className="text-lg font-medium text-white mb-2">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  onSettingsChange({
                    includeHashes: true,
                    customIndex: '',
                    autoResolve: true,
                    showDependencies: true,
                    exportFormat: 'standard',
                  })
                }
                className="px-3 py-1 bg-blue-500/20 text-blue-200 rounded hover:bg-blue-500/30 transition-colors text-sm"
              >
                Production Ready
              </button>
              <button
                onClick={() =>
                  onSettingsChange({
                    includeHashes: false,
                    customIndex: '',
                    autoResolve: true,
                    showDependencies: false,
                    exportFormat: 'loose',
                  })
                }
                className="px-3 py-1 bg-green-500/20 text-green-200 rounded hover:bg-green-500/30 transition-colors text-sm"
              >
                Development
              </button>
              <button
                onClick={() =>
                  onSettingsChange({
                    includeHashes: false,
                    customIndex: '',
                    autoResolve: false,
                    showDependencies: false,
                    exportFormat: 'standard',
                  })
                }
                className="px-3 py-1 bg-gray-500/20 text-gray-200 rounded hover:bg-gray-500/30 transition-colors text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
