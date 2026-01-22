'use client';

import { useState, useTransition } from 'react';
import { Cable, Plus, Trash2, CheckCircle, XCircle, Loader2, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { 
  createConnector, 
  deleteConnector, 
  testConnector,
  testConnectorConfig,
  type ConnectorFormData,
} from '@/actions/connectors';
import type { DataConnector, AzureConnectorConfig } from '@/db/schema';

interface ConnectorsClientProps {
  initialConnectors: DataConnector[];
}

const providerLabels = {
  azure: 'Azure Blob Storage',
  aws: 'AWS S3 (Coming Soon)',
  gcp: 'Google Cloud Storage (Coming Soon)',
};

const providerIcons = {
  azure: '☁️',
  aws: '📦',
  gcp: '🌐',
};

export function ConnectorsClient({ initialConnectors }: ConnectorsClientProps) {
  const [connectors, setConnectors] = useState<DataConnector[]>(initialConnectors);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; valid: boolean; message: string } | null>(null);
  
  // Pre-save test state
  const [isPreTesting, setIsPreTesting] = useState(false);
  const [preTestResult, setPreTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<'azure' | 'aws' | 'gcp'>('azure');
  const [authMethod, setAuthMethod] = useState<'sas' | 'key'>('sas');
  
  // SAS URL method
  const [sasUrl, setSasUrl] = useState('');
  
  // Key method
  const [storageAccountName, setStorageAccountName] = useState('');
  const [containerName, setContainerName] = useState('');
  const [accountKey, setAccountKey] = useState('');
  
  // Optional fields
  const [blobPrefix, setBlobPrefix] = useState('');

  const resetForm = () => {
    setName('');
    setProvider('azure');
    setAuthMethod('sas');
    setSasUrl('');
    setStorageAccountName('');
    setContainerName('');
    setAccountKey('');
    setBlobPrefix('');
    setPreTestResult(null);
  };

  const buildConfig = (): AzureConnectorConfig | null => {
    if (authMethod === 'sas') {
      if (!sasUrl.trim()) {
        return null;
      }
      return {
        authMethod: 'sas',
        sasUrl: sasUrl.trim(),
        blobPrefix: blobPrefix.trim() || undefined,
      };
    } else {
      if (!storageAccountName.trim() || !containerName.trim() || !accountKey.trim()) {
        return null;
      }
      return {
        authMethod: 'key',
        storageAccountName: storageAccountName.trim(),
        containerName: containerName.trim(),
        accountKey: accountKey.trim(),
        blobPrefix: blobPrefix.trim() || undefined,
      };
    }
  };

  const handlePreTest = async () => {
    const config = buildConfig();
    if (!config) {
      alert(authMethod === 'sas' 
        ? 'Please provide a SAS URL' 
        : 'Please provide storage account name, container name, and account key');
      return;
    }

    setIsPreTesting(true);
    setPreTestResult(null);

    const result = await testConnectorConfig(provider, config);
    
    if (result.success) {
      setPreTestResult(result.data);
    } else {
      setPreTestResult({ valid: false, message: result.error || 'Test failed' });
    }

    setIsPreTesting(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    const config = buildConfig();
    if (!config) {
      alert(authMethod === 'sas' 
        ? 'Please provide a SAS URL' 
        : 'Please provide storage account name, container name, and account key');
      return;
    }

    const formData: ConnectorFormData = {
      name: name.trim(),
      provider,
      config,
    };

    startTransition(async () => {
      const result = await createConnector(formData);
      if (result.success) {
        setConnectors((prev) => [result.data, ...prev]);
        setIsCreateOpen(false);
        resetForm();
      } else {
        alert(result.error);
      }
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      const result = await deleteConnector(id);
      if (result.success) {
        setConnectors((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert(result.error);
      }
    });
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);

    const result = await testConnector(id);
    
    if (result.success) {
      setTestResult({ id, ...result.data });
      // Update local state with new status
      setConnectors((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: result.data.valid ? 'active' : 'error' }
            : c
        )
      );
    } else {
      setTestResult({ id, valid: false, message: result.error });
    }

    setTestingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Cable className="h-8 w-8" />
            Connectors
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your cloud storage connections for cost data imports
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Connector
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Connector</DialogTitle>
              <DialogDescription>
                Connect to your cloud storage to import cost export files.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Connector Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production Azure Storage"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Cloud Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="azure">☁️ Azure Blob Storage</SelectItem>
                    <SelectItem value="aws" disabled>📦 AWS S3 (Coming Soon)</SelectItem>
                    <SelectItem value="gcp" disabled>🌐 Google Cloud Storage (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {provider === 'azure' && (
                <>
                  <div className="space-y-2">
                    <Label>Authentication Method</Label>
                    <Select value={authMethod} onValueChange={(v) => setAuthMethod(v as 'sas' | 'key')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sas">🔗 Direct SAS URL (Recommended)</SelectItem>
                        <SelectItem value="key">🔑 Storage Account Key</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {authMethod === 'sas' 
                        ? 'Paste a SAS URL generated from Azure Portal'
                        : 'Provide credentials for automatic token generation'}
                    </p>
                  </div>

                  {authMethod === 'sas' ? (
                    <div className="space-y-2">
                      <Label htmlFor="sasUrl">SAS URL</Label>
                      <Input
                        id="sasUrl"
                        type="password"
                        placeholder="https://account.blob.core.windows.net/container?sv=...&sig=..."
                        value={sasUrl}
                        onChange={(e) => setSasUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Generate a SAS URL from Azure Portal → Storage Account → Shared access signature.
                        Include Read and List permissions for the container.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="storageAccount">Storage Account Name</Label>
                        <Input
                          id="storageAccount"
                          placeholder="mystorageaccount"
                          value={storageAccountName}
                          onChange={(e) => setStorageAccountName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="container">Container Name</Label>
                        <Input
                          id="container"
                          placeholder="cost-exports"
                          value={containerName}
                          onChange={(e) => setContainerName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="accountKey">Storage Account Key</Label>
                        <Input
                          id="accountKey"
                          type="password"
                          placeholder="xxxxxxxx...base64..."
                          value={accountKey}
                          onChange={(e) => setAccountKey(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Found in Azure Portal → Storage Account → Access keys
                        </p>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="blobPrefix">Blob Prefix (Optional)</Label>
                    <Input
                      id="blobPrefix"
                      placeholder="cost-exports/2024/"
                      value={blobPrefix}
                      onChange={(e) => setBlobPrefix(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Filter files by path prefix (e.g., folder path)
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Pre-save test result */}
            {preTestResult && (
              <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                preTestResult.valid 
                  ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {preTestResult.valid ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{preTestResult.message}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="secondary" 
                onClick={handlePreTest} 
                disabled={isPreTesting}
              >
                {isPreTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
              <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Connector
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connectors Grid */}
      {connectors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cable className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No connectors yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-1">
              Add a cloud storage connector to start importing your cost export data.
            </p>
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Connector
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connectors.map((connector) => {
            const config = connector.config as AzureConnectorConfig | null;
            const isTestingThis = testingId === connector.id;
            const thisTestResult = testResult?.id === connector.id ? testResult : null;

            return (
              <Card key={connector.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {providerIcons[connector.provider]}
                      </span>
                      <div>
                        <CardTitle className="text-lg">{connector.name}</CardTitle>
                        <CardDescription>
                          {providerLabels[connector.provider]}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(connector.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {config && (
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Auth Method:</span>
                        <Badge variant="outline">
                          {config.authMethod === 'sas' ? '🔗 SAS URL' : '🔑 Account Key'}
                        </Badge>
                      </div>
                      {config.authMethod === 'sas' ? (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SAS URL:</span>
                          <span className="font-mono text-xs">
                            {config.sasUrl ? '••••••••' + config.sasUrl.slice(-20) : '—'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Storage Account:</span>
                            <span className="font-mono">{config.storageAccountName || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Container:</span>
                            <span className="font-mono">{config.containerName || '—'}</span>
                          </div>
                        </>
                      )}
                      {config.blobPrefix && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prefix:</span>
                          <span className="font-mono">{config.blobPrefix}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {thisTestResult && (
                    <div
                      className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                        thisTestResult.valid
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {thisTestResult.valid ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      {thisTestResult.message}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleTest(connector.id)}
                      disabled={isTestingThis}
                    >
                      {isTestingThis ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Connector</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{connector.name}&quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(connector.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">💡 How Connectors Work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Connectors</strong> store your cloud provider configuration (storage account, container name).
            The actual storage access key should be set as an environment variable (<code>AZURE_STORAGE_KEY</code>).
          </p>
          <p>
            Once configured, go to <strong>Data Sources</strong> to browse and load files from your connectors into the analytics engine.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
