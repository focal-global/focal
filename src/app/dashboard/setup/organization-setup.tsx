'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, ArrowRight, Check, Loader2, Mail, Crown, Shield, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  createOrganization, 
  getPendingInvitations, 
  acceptInvitation, 
  declineInvitation,
  type PendingInvitation,
  type SubscriptionPlan 
} from '@/actions/organizations';

interface OrganizationSetupProps {
  userEmail: string;
  userName: string;
}

const plans: Array<{
  id: SubscriptionPlan;
  name: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}> = [
  {
    id: 'free',
    name: 'Free Trial',
    price: '$0',
    description: '14-day trial to explore Focal',
    features: [
      'Up to 3 cloud accounts',
      '1 team member',
      '30 days data retention',
      'Basic cost dashboards',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$99',
    description: 'For growing teams and businesses',
    features: [
      'Unlimited cloud accounts',
      'Up to 10 team members',
      '1 year data retention',
      'Advanced analytics & reports',
      'Budget alerts & anomaly detection',
      'Priority support',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Unlimited data retention',
      'Custom integrations',
      'SSO & advanced security',
      'Dedicated account manager',
      'SLA guarantee',
    ],
  },
];

export function OrganizationSetup({ userEmail, userName }: OrganizationSetupProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro');
  const [orgName, setOrgName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvitations() {
      const result = await getPendingInvitations();
      if (result.success) {
        setInvitations(result.data);
      }
      setLoadingInvitations(false);
    }
    loadInvitations();
  }, []);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await createOrganization({
      name: orgName.trim(),
      plan: selectedPlan,
    });

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    setAcceptingId(invitationId);
    setError(null);

    const result = await acceptInvitation(invitationId);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error);
      setAcceptingId(null);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    setDecliningId(invitationId);
    setError(null);

    const result = await declineInvitation(invitationId);

    if (result.success) {
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } else {
      setError(result.error);
    }
    setDecliningId(null);
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

  // Choose mode view
  if (mode === 'choose') {
    return (
      <div className="space-y-8">
        {/* Pending Invitations */}
        {!loadingInvitations && invitations.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Invitations
              </CardTitle>
              <CardDescription>
                You have been invited to join the following organizations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{inv.organizationName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Invited by {inv.inviterName}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {getRoleIcon(inv.role)}
                          {inv.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeclineInvitation(inv.id)}
                      disabled={decliningId === inv.id || acceptingId === inv.id}
                    >
                      {decliningId === inv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Decline'
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(inv.id)}
                      disabled={acceptingId === inv.id || decliningId === inv.id}
                    >
                      {acceptingId === inv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Accept'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Options */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="cursor-pointer transition-all hover:border-primary hover:shadow-lg"
            onClick={() => setMode('create')}
          >
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Create an Organization</CardTitle>
              <CardDescription>
                Start a new organization and invite your team members to collaborate on FinOps analytics.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Choose your subscription plan
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Connect cloud billing accounts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Invite team members
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full">
                Create Organization
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:border-primary hover:shadow-lg"
            onClick={() => setMode('join')}
          >
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <CardTitle>Join an Organization</CardTitle>
              <CardDescription>
                Join an existing organization. Ask your admin to send you an invitation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Request an invitation from your admin
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Accept via email or this dashboard
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Start collaborating immediately
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                View Join Options
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Create organization view
  if (mode === 'create') {
    return (
      <div className="space-y-8">
        <Button 
          variant="ghost" 
          onClick={() => setMode('choose')}
          className="mb-4"
        >
          ← Back to options
        </Button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Create Your Organization</h2>
          <p className="text-muted-foreground">
            Choose a plan and set up your organization
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Plan Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={`cursor-pointer transition-all relative ${
                selectedPlan === plan.id 
                  ? 'border-primary shadow-lg ring-2 ring-primary' 
                  : 'hover:border-muted-foreground/50'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 right-4 bg-primary">
                  Most Popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {selectedPlan === plan.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.price !== 'Custom' && <span className="text-muted-foreground">/month</span>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Organization Name Form */}
        <form onSubmit={handleCreateOrganization} className="max-w-md mx-auto space-y-6">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              placeholder="Acme Inc."
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-sm text-muted-foreground">
              This will be your organization&apos;s display name in Focal
            </p>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Organization with {plans.find(p => p.id === selectedPlan)?.name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          {selectedPlan === 'enterprise' && (
            <p className="text-sm text-muted-foreground text-center">
              Our team will contact you to discuss your requirements and pricing.
            </p>
          )}
        </form>
      </div>
    );
  }

  // Join organization view
  if (mode === 'join') {
    return (
      <div className="space-y-8">
        <Button 
          variant="ghost" 
          onClick={() => setMode('choose')}
          className="mb-4"
        >
          ← Back to options
        </Button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Join an Organization</h2>
          <p className="text-muted-foreground">
            Request an invitation from your organization admin
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="max-w-2xl mx-auto">
          {/* Pending Invitations */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Your Invitations
              </CardTitle>
              <CardDescription>
                Invitations sent to {userEmail}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingInvitations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No pending invitations</p>
                  <p className="text-sm mt-1">
                    Ask your organization admin to send you an invitation
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{inv.organizationName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Invited by {inv.inviterName}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {getRoleIcon(inv.role)}
                              {inv.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeclineInvitation(inv.id)}
                          disabled={decliningId === inv.id || acceptingId === inv.id}
                        >
                          {decliningId === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Decline'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptInvitation(inv.id)}
                          disabled={acceptingId === inv.id || decliningId === inv.id}
                        >
                          {acceptingId === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Accept & Join'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Get an Invitation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Contact your organization admin</p>
                  <p className="text-sm text-muted-foreground">
                    Ask them to invite you using your email address: <strong>{userEmail}</strong>
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Check your invitations</p>
                  <p className="text-sm text-muted-foreground">
                    Once invited, the invitation will appear above. You can also check your email.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Accept and start collaborating</p>
                  <p className="text-sm text-muted-foreground">
                    Click accept to join the organization and access shared dashboards.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
