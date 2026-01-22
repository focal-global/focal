'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Users, 
  Crown, 
  Shield, 
  User, 
  UserPlus, 
  Trash2, 
  Loader2,
  Mail,
  Check,
  X,
  AlertCircle,
  Copy,
  MoreHorizontal,
  Pencil
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getUserOrganization,
  getOrganizationMembers,
  getOrganizationInvitations,
  updateOrganization,
  inviteUser,
  removeMember,
  cancelInvitation,
  updateMemberRole,
  type OrganizationWithRole,
  type OrganizationInvitation,
} from '@/actions/organizations';

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
}

interface OrganizationSettingsProps {
  showMembersOnly?: boolean;
}

export function OrganizationSettings({ showMembersOnly = false }: OrganizationSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [organization, setOrganization] = useState<OrganizationWithRole | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit org state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  
  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  
  // Remove member/cancel invitation state
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    
    try {
      const [orgResult, membersResult, invitationsResult] = await Promise.all([
        getUserOrganization(),
        getOrganizationMembers(),
        getOrganizationInvitations(),
      ]);

      if (orgResult.success && orgResult.data) {
        setOrganization(orgResult.data);
        setEditName(orgResult.data.name);
      }

      if (membersResult.success) {
        setMembers(membersResult.data);
      }

      if (invitationsResult.success) {
        setPendingInvitations(invitationsResult.data);
      }
    } catch (err) {
      setError('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  }

  const handleSaveName = async () => {
    if (!editName.trim() || editName === organization?.name) {
      setIsEditing(false);
      return;
    }

    setSavingName(true);
    setError(null);

    const result = await updateOrganization({ name: editName.trim() });

    if (result.success) {
      setOrganization(result.data);
      setIsEditing(false);
    } else {
      setError(result.error);
    }
    
    setSavingName(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);

    const result = await inviteUser(inviteEmail.trim(), inviteRole);

    if (result.success) {
      setInviteSuccess(true);
      // Reload invitations to show the new one
      const invitationsResult = await getOrganizationInvitations();
      if (invitationsResult.success) {
        setPendingInvitations(invitationsResult.data);
      }
      setTimeout(() => {
        setInviteOpen(false);
        setInviteEmail('');
        setInviteRole('member');
        setInviteSuccess(false);
      }, 1500);
    } else {
      setError(result.error);
    }

    setInviting(false);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setCancellingId(invitationId);
    setError(null);

    const result = await cancelInvitation(invitationId);

    if (result.success) {
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } else {
      setError(result.error);
    }

    setCancellingId(null);
  };

  const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'member') => {
    setUpdatingRoleId(memberId);
    setError(null);

    const result = await updateMemberRole(memberId, newRole);

    if (result.success) {
      // Update local state
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, role: newRole } : m
        )
      );
    } else {
      setError(result.error);
    }

    setUpdatingRoleId(null);
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    setError(null);

    const result = await removeMember(memberId);

    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } else {
      setError(result.error);
    }

    setRemovingId(null);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Owner</Badge>;
      case 'admin':
        return <Badge variant="default" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Admin</Badge>;
      default:
        return <Badge variant="secondary">Member</Badge>;
    }
  };

  const isOwner = organization?.role === 'owner';
  const isAdmin = organization?.role === 'owner' || organization?.role === 'admin';

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!organization) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">No organization found</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard/setup')}>
            Set up Organization
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Organization Info - Only show when not in members-only mode */}
      {!showMembersOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </CardTitle>
            <CardDescription>
              Manage your organization&apos;s settings and information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="max-w-xs"
                    disabled={savingName}
                  />
                  <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(organization.name);
                    }}
                    disabled={savingName}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">{organization.name}</h3>
                  {isOwner && (
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {organization.memberCount} members
                </span>
                <span>•</span>
                <span>Your role: {organization.role}</span>
              </div>
            </div>
          </div>

          {organization.slug && (
            <div className="pt-2">
              <Label className="text-sm text-muted-foreground">Organization Slug</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="px-2 py-1 bg-muted rounded text-sm">{organization.slug}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(organization.slug || '');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              Manage your organization&apos;s team members
            </CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join {organization.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={inviting || inviteSuccess}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value: 'admin' | 'member') => setInviteRole(value)}
                      disabled={inviting || inviteSuccess}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Member - Can view dashboards and data
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Admin - Can manage connectors and invite users
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteOpen(false)}
                    disabled={inviting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim() || inviteSuccess}>
                    {inviting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : inviteSuccess ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Sent!
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Active Members */}
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        {getRoleIcon(member.role)}
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(member.role)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                      Active
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {member.role !== 'owner' && isOwner && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updatingRoleId === member.id || removingId === member.id}
                            >
                              {updatingRoleId === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleUpdateRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              {member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove from Team
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {member.name} from the organization?
                                    They will lose access to all organization data and dashboards.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              
              {/* Pending Invitations */}
              {pendingInvitations.map((inv) => (
                <TableRow key={inv.id} className="bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">{inv.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Invited by {inv.inviterName}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(inv.role)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      Invite Pending
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleCancelInvitation(inv.id)}
                        disabled={cancellingId === inv.id}
                      >
                        {cancellingId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              
              {members.length === 0 && pendingInvitations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-muted-foreground py-8">
                    No team members yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
