'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  createSavedView,
  getSavedViews,
  updateSavedView,
  deleteSavedView,
  generateShareableUrl,
} from '@/actions/saved-views';
import type { SavedView, SavedViewConfig } from '@/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface SavedViewsPanelProps {
  currentConfig: SavedViewConfig;
  onLoadView: (view: SavedView) => void;
  viewType?: 'dashboard' | 'report' | 'query';
}

// ============================================================================
// SavedViewsPanel Component
// ============================================================================

export function SavedViewsPanel({
  currentConfig,
  onLoadView,
  viewType = 'query',
}: SavedViewsPanelProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [viewName, setViewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Load saved views
  const loadViews = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSavedViews(viewType);
      if (result.success) {
        setSavedViews(result.data);
      }
    } catch (err) {
      console.error('Failed to load saved views:', err);
    }
    setIsLoading(false);
  }, [viewType]);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  // Save current view
  const handleSaveView = async () => {
    if (!viewName.trim()) return;
    
    setIsSaving(true);
    try {
      const result = await createSavedView({
        name: viewName.trim(),
        type: viewType,
        config: currentConfig,
      });
      
      if (result.success) {
        setSavedViews(prev => [result.data, ...prev]);
        setIsSaveDialogOpen(false);
        setViewName('');
      }
    } catch (err) {
      console.error('Failed to save view:', err);
    }
    setIsSaving(false);
  };

  // Delete view
  const handleDeleteView = async (id: string) => {
    try {
      const result = await deleteSavedView(id);
      if (result.success) {
        setSavedViews(prev => prev.filter(v => v.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete view:', err);
    }
  };

  // Share view
  const handleShareView = async (id: string) => {
    setSelectedViewId(id);
    setIsShareDialogOpen(true);
    
    try {
      const result = await generateShareableUrl(id);
      if (result.success) {
        const fullUrl = `${window.location.origin}${result.data.url}`;
        setShareUrl(fullUrl);
      }
    } catch (err) {
      console.error('Failed to generate share URL:', err);
    }
  };

  // Copy URL
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const viewTypeLabels = {
    dashboard: 'Dashboard',
    report: 'Report',
    query: 'Query',
  };

  return (
    <div className="flex items-center gap-2">
      {/* Saved Views Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            Saved Views
            {savedViews.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {savedViews.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : savedViews.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No saved {viewTypeLabels[viewType].toLowerCase()}s yet
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-sm group"
                >
                  <button
                    className="flex-1 text-left text-sm truncate"
                    onClick={() => onLoadView(view)}
                  >
                    {view.name}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onLoadView(view)}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Load
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareView(view.id)}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteView(view.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsSaveDialogOpen(true)}>
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Save Current View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save {viewTypeLabels[viewType]}</DialogTitle>
            <DialogDescription>
              Save the current view configuration for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder={`My ${viewTypeLabels[viewType]}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveView} disabled={isSaving || !viewName.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Share View</DialogTitle>
            <DialogDescription>
              Share this view with others in your organization. The link will expire in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shareable Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopyUrl}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Note: Recipients must be logged in and have access to the same data sources
              to view this shared view.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
