import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Zap,
  Code,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../api/client';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

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

  const handleRefreshCache = useCallback(async () => {
    const now = Date.now();
    const oneMinute = 60 * 1000;

    // Check if 1 minute has passed since last refresh
    if (lastRefresh && now - lastRefresh < oneMinute) {
      return;
    }

    setIsRefreshing(true);
    try {
      const result = await apiClient.refreshCache();
      console.log('Cache refresh result:', result);

      setLastRefresh(now);

      // Keep the button disabled for 1 minute
      setTimeout(() => {
        setIsRefreshing(false);
      }, oneMinute);
    } catch (error) {
      console.error('Cache refresh failed:', error);
      setIsRefreshing(false);
    }
  }, [lastRefresh]);

  // Calculate remaining time for button to be enabled
  const getRemainingTime = useCallback(() => {
    if (!lastRefresh) return 0;
    const elapsed = Date.now() - lastRefresh;
    const oneMinute = 60 * 1000;
    return Math.max(0, oneMinute - elapsed);
  }, [lastRefresh]);

  const [remainingTime, setRemainingTime] = useState(0);

  // Update remaining time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime(getRemainingTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [getRemainingTime]);

  const canRefresh = !isRefreshing && remainingTime === 0;

  return (
    <div className="container">
      <Card className="w-full bg-zinc-900 border-zinc-800">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className="flex items-center justify-between text-gray-100 text-xl font-bold">
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Settings
            </div>
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-blue-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-blue-400" />
            )}
          </CardTitle>
          <CardDescription className="text-gray-400 text-base">
            Configure package management and export options
          </CardDescription>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-6">
            <div className="grid gap-6">
              <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <div className="space-y-1">
                  <Label className="text-gray-100 font-semibold text-base">
                    Include Hashes
                  </Label>
                  <p className="text-sm text-gray-400">
                    Generate <span className="mono text-amber-400">SHA256</span>{' '}
                    hashes for packages
                  </p>
                </div>
                <Switch
                  checked={settings.includeHashes}
                  onCheckedChange={checked =>
                    handleSettingChange('includeHashes', checked)
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <div className="space-y-1">
                  <Label className="text-gray-100 font-semibold text-base">
                    Auto-resolve Dependencies
                  </Label>
                  <p className="text-sm text-gray-400">
                    Automatically add required dependencies
                  </p>
                </div>
                <Switch
                  checked={settings.autoResolve}
                  onCheckedChange={checked =>
                    handleSettingChange('autoResolve', checked)
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <div className="space-y-1">
                  <Label className="text-gray-100 font-semibold text-base">
                    Show Dependencies
                  </Label>
                  <p className="text-sm text-gray-400">
                    Display dependency packages in list
                  </p>
                </div>
                <Switch
                  checked={settings.showDependencies}
                  onCheckedChange={checked =>
                    handleSettingChange('showDependencies', checked)
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>

              <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-3">
                <div className="space-y-1">
                  <Label className="text-gray-100 font-semibold text-base">
                    Export Format
                  </Label>
                  <p className="text-sm text-gray-400">
                    Choose how version constraints are formatted
                  </p>
                </div>
                <select
                  value={settings.exportFormat}
                  onChange={e =>
                    handleSettingChange(
                      'exportFormat',
                      e.target.value as Settings['exportFormat']
                    )
                  }
                  className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-gray-200 mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="standard" className="bg-zinc-800">
                    Standard (package==version)
                  </option>
                  <option value="pinned" className="bg-zinc-800">
                    Pinned (package&gt;=version)
                  </option>
                  <option value="loose" className="bg-zinc-800">
                    Loose (package)
                  </option>
                </select>
              </div>

              <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-3">
                <div className="space-y-1">
                  <Label className="text-gray-100 font-semibold text-base">
                    Custom Package Index
                  </Label>
                  <p className="text-sm text-gray-400">
                    URL for private package repository
                  </p>
                </div>
                <div className="space-y-3">
                  <Input
                    type="url"
                    value={customIndexInput}
                    onChange={e => setCustomIndexInput(e.target.value)}
                    placeholder="https://your-private-pypi.com/simple/"
                    className="bg-zinc-900 border-zinc-600 text-gray-200 placeholder:text-gray-500 mono focus:border-blue-500"
                  />

                  {customIndexInput !== settings.customIndex && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCustomIndexSave}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        onClick={handleCustomIndexCancel}
                        size="sm"
                        variant="outline"
                        className="border-zinc-600 text-gray-300 hover:bg-zinc-700"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator className="bg-zinc-700" />

            <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-100">
                  Quick Actions
                </h3>
                <p className="text-sm text-gray-400">
                  Apply preset configurations for common use cases
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    onSettingsChange({
                      includeHashes: true,
                      customIndex: '',
                      autoResolve: true,
                      showDependencies: true,
                      exportFormat: 'standard',
                    })
                  }
                  variant="outline"
                  size="sm"
                  className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Production Ready
                </Button>
                <Button
                  onClick={() =>
                    onSettingsChange({
                      includeHashes: false,
                      customIndex: '',
                      autoResolve: true,
                      showDependencies: false,
                      exportFormat: 'loose',
                    })
                  }
                  variant="outline"
                  size="sm"
                  className="border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
                >
                  <Code className="h-3 w-3 mr-1" />
                  Development
                </Button>
                <Button
                  onClick={() =>
                    onSettingsChange({
                      includeHashes: false,
                      customIndex: '',
                      autoResolve: false,
                      showDependencies: false,
                      exportFormat: 'standard',
                    })
                  }
                  variant="outline"
                  size="sm"
                  className="border-zinc-600 text-gray-300 hover:bg-zinc-700"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <Button
                  onClick={handleRefreshCache}
                  disabled={!canRefresh}
                  variant="outline"
                  size="sm"
                  className={`border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white ${
                    !canRefresh ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={
                    isRefreshing
                      ? 'Refreshing cache...'
                      : remainingTime > 0
                        ? `Wait ${Math.ceil(remainingTime / 1000)}s before refreshing again`
                        : 'Refresh package cache to get latest dependency data'
                  }
                >
                  <RefreshCw
                    className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  {isRefreshing
                    ? 'Refreshing...'
                    : remainingTime > 0
                      ? `Wait ${Math.ceil(remainingTime / 1000)}s`
                      : 'Refresh Cache'}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
