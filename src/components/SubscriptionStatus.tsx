import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { AlertCircle, CheckCircle2, Crown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const SubscriptionStatus = () => {
  const { subscription, usage, loading, getLimitPercentage, isLimitReached } = useSubscription();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Loading subscription...</p>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Anda belum memiliki subscription aktif. Hubungi admin untuk aktivasi.
        </AlertDescription>
      </Alert>
    );
  }

  const plan = subscription.plan;
  const devicesPercentage = getLimitPercentage('devices');
  const contactsPercentage = getLimitPercentage('contacts');
  const broadcastsPercentage = getLimitPercentage('broadcasts');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Plan Anda
          </CardTitle>
          <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
            {subscription.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold">{plan.name}</h3>
            <span className="text-muted-foreground">
              Rp {plan.price.toLocaleString("id-ID")}/bulan
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Devices</span>
              <div className="flex items-center gap-2">
                <span className={isLimitReached('devices') ? "text-destructive" : "text-muted-foreground"}>
                  {usage.devices_count} / {plan.max_devices}
                </span>
                {isLimitReached('devices') ? (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
            </div>
            <Progress 
              value={devicesPercentage} 
              className={devicesPercentage >= 90 ? "bg-destructive/20" : ""} 
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Contacts</span>
              <div className="flex items-center gap-2">
                <span className={isLimitReached('contacts') ? "text-destructive" : "text-muted-foreground"}>
                  {usage.contacts_count} / {plan.max_contacts.toLocaleString()}
                </span>
                {isLimitReached('contacts') ? (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
            </div>
            <Progress 
              value={contactsPercentage} 
              className={contactsPercentage >= 90 ? "bg-destructive/20" : ""} 
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Broadcasts (Bulan Ini)</span>
              <div className="flex items-center gap-2">
                <span className={isLimitReached('broadcasts') ? "text-destructive" : "text-muted-foreground"}>
                  {usage.broadcasts_count} / {plan.max_broadcasts}
                </span>
                {isLimitReached('broadcasts') ? (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
            </div>
            <Progress 
              value={broadcastsPercentage} 
              className={broadcastsPercentage >= 90 ? "bg-destructive/20" : ""} 
            />
          </div>
        </div>

        {plan.features && plan.features.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Fitur Aktif:</p>
            <div className="flex flex-wrap gap-2">
              {plan.features.map((feature, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {feature.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {subscription.expires_at && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Berakhir: {new Date(subscription.expires_at).toLocaleDateString("id-ID")}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
