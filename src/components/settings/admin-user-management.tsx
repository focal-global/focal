'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  UserPlus,
  UserMinus,
  Shield,
  ShieldCheck,
  Crown,
  Clock,
  Activity,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  searchUsers,
  updateUserRole,
  toggleUserActive,
  getUserActivityLogs,
  type User,
  type UserSearchResult,
  type ActivityLogResult,
} from '@/actions/user-management';

// Constants
const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner', icon: Crown, color: 'text-amber-500' },
  { value: 'admin', label: 'Admin', icon: ShieldCheck, color: 'text-blue-500' },
  { value: 'member', label: 'Member', icon: Shield, color: 'text-gray-500' },
] as const;

const ITEMS_PER_PAGE = 20;

export function AdminUserManagement() {
  const [users, setUsers] = useState<UserSearchResult['users']>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showActivityLogs, setShowActivityLogs] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogResult['activities']>([]);

  // Load users with search and pagination
  const loadUsers = useCallback(async (query = searchQuery, page = currentPage) => {
    try {
      setLoading(true);
      const result = await searchUsers(query, page, ITEMS_PER_PAGE);
      
      if (result.success && result.data) {
        setUsers(result.data.users);
        setTotalUsers(result.data.total);
        setTotalPages(Math.ceil(result.data.total / ITEMS_PER_PAGE));
        setCurrentPage(result.data.page);
      } else {
        toast.error(result.error || 'Failed to load users');
        setUsers([]);
      }
    } catch (error) {
      console.error('Load users error:', error);
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, currentPage]);

  useEffect(() => {
    loadUsers();
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    loadUsers(query, 1);
  };

  // Handle role update
  const handleRoleUpdate = async (userId: string, newRole: 'owner' | 'admin' | 'member') => {
    if (updatingUserId) return;
    
    setUpdatingUserId(userId);
    try {
      const result = await updateUserRole(userId, newRole);
      
      if (result.success) {
        toast.success('User role updated successfully');
        await loadUsers(); // Refresh the list
      } else {
        toast.error(result.error || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Update role error:', error);
      toast.error('Failed to update user role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Handle user activation toggle
  const handleUserToggle = async (userId: string, isActive: boolean) => {
    if (updatingUserId) return;
    
    setUpdatingUserId(userId);
    try {
      const result = await toggleUserActive(userId, isActive);
      
      if (result.success) {
        toast.success(`User ${isActive ? 'deactivated' : 'activated'} successfully`);
        await loadUsers(); // Refresh the list
      } else {
        toast.error(result.error || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Toggle user error:', error);
      toast.error('Failed to update user status');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Load activity logs for selected user
  const loadActivityLogs = async (userId: string) => {
    try {
      const result = await getUserActivityLogs(userId, 1, 50);
      
      if (result.success && result.data) {
        setActivityLogs(result.data.activities);
      } else {
        toast.error(result.error || 'Failed to load activity logs');
        setActivityLogs([]);
      }
    } catch (error) {
      console.error('Load activity error:', error);
      toast.error('Failed to load activity logs');
      setActivityLogs([]);
    }
  };

  // Helper functions
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleInfo = (role: 'owner' | 'admin' | 'member' | null | undefined) => {
    return ROLE_OPTIONS.find(r => r.value === role) || ROLE_OPTIONS[2];
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatActivity = (activityType: string) => {
    const types: Record<string, string> = {
      'login': 'Logged in',
      'logout': 'Logged out',
      'profile_update': 'Updated profile',
      'role_change': 'Role changed',
      'status_change': 'Status changed',
      'password_change': 'Changed password',
      'organization_join': 'Joined organization',
      'organization_leave': 'Left organization',
    };
    return types[activityType] || activityType.replace('_', ' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" />
          User Management
        </h2>
        <p className="text-muted-foreground">
          Manage users, roles, and permissions across your organization.
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => loadUsers()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({totalUsers})</CardTitle>
          <CardDescription>
            Showing {users.length} of {totalUsers} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const roleInfo = getRoleInfo(user.memberRole);
                    const RoleIcon = roleInfo.icon;
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.image || ''} alt={user.name} />
                              <AvatarFallback className="text-xs">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <RoleIcon className={`h-4 w-4 ${roleInfo.color}`} />
                            <span className="capitalize">{roleInfo.label}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {user.organizationName ? (
                            <Badge variant="outline">{user.organizationName}</Badge>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={() => handleUserToggle(user.id, user.isActive)}
                              disabled={updatingUserId === user.id}
                            />
                            <span className="text-sm">
                              {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(user.lastLoginAt)}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                {updatingUserId === user.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowActivityLogs(true);
                                  loadActivityLogs(user.id);
                                }}
                              >
                                <Activity className="h-4 w-4 mr-2" />
                                View Activity
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                              
                              {ROLE_OPTIONS.map((role) => {
                                const Icon = role.icon;
                                return (
                                  <DropdownMenuItem
                                    key={role.value}
                                    onClick={() => handleRoleUpdate(user.id, role.value)}
                                    disabled={user.memberRole === role.value}
                                  >
                                    <Icon className={`h-4 w-4 mr-2 ${role.color}`} />
                                    Make {role.label}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalUsers)} of {totalUsers} users
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = currentPage - 1;
                        setCurrentPage(newPage);
                        loadUsers(searchQuery, newPage);
                      }}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8"
                            onClick={() => {
                              setCurrentPage(pageNum);
                              loadUsers(searchQuery, pageNum);
                            }}
                            disabled={loading}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = currentPage + 1;
                        setCurrentPage(newPage);
                        loadUsers(searchQuery, newPage);
                      }}
                      disabled={currentPage === totalPages || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Activity Logs Dialog */}
      <AlertDialog open={showActivityLogs} onOpenChange={setShowActivityLogs}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Logs - {selectedUser?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Recent activity for {selectedUser?.email}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            {activityLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No activity logs found
              </p>
            ) : (
              <div className="space-y-2">
                {activityLogs.map((log, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-shrink-0 mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {formatActivity((log as any).activityType)}
                      </div>
                      {(log as any).description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {(log as any).description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}