import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, Clock, Truck, Store, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientLayout from '@/components/client/ClientLayout';

interface OrderTrackingResponse {
  ok: boolean;
  data?: {
    orderNumber: string;
    status: string;
    fulfillmentMethod: 'delivery' | 'pickup';
    paidAt: string | null;
    paymentConfirmed: boolean;
    createdAt: string;
    updatedAt: string;
    statusHistory: Array<{
      status: string;
      createdAt: string;
    }>;
  };
  message?: string;
  error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  awaiting_payment: 'En attente de paiement',
  paid: 'Paiement confirmé',
  preparing: 'En préparation',
  ready: 'Prête',
  in_delivery: 'En livraison',
  completed: 'Terminée',
  cancelled: 'Annulée',
  payment_failed: 'Paiement échoué',
};

function getStatusDescription(status: string, fulfillmentMethod: 'delivery' | 'pickup') {
  switch (status) {
    case 'awaiting_payment':
      return 'Votre commande a été créée mais le paiement n’est pas encore confirmé.';
    case 'paid':
      return 'Votre paiement a bien été confirmé. La commande va être traitée.';
    case 'preparing':
      return 'Votre commande est en cours de préparation.';
    case 'ready':
      return fulfillmentMethod === 'pickup'
        ? 'Votre commande est prête et peut être récupérée sur place.'
        : 'Votre commande est prête à partir.';
    case 'in_delivery':
      return 'Votre commande est en cours de livraison.';
    case 'completed':
      return 'Votre commande est terminée.';
    case 'cancelled':
      return 'Votre commande a été annulée.';
    case 'payment_failed':
      return 'Le paiement de votre commande a échoué.';
    default:
      return 'Le statut de votre commande a été mis à jour.';
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function OrderTrackingPage() {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderData, setOrderData] = useState<OrderTrackingResponse['data'] | null>(null);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!token) {
        if (!isMounted) return;
        setError('Lien de suivi invalide.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/public/orders/tracking/${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        const json = (await response.json()) as OrderTrackingResponse;

        if (!response.ok || !json.ok || !json.data) {
          throw new Error(json.message || 'Impossible de charger le suivi de commande.');
        }

        if (!isMounted) return;
        setOrderData(json.data);
      } catch (err) {
        console.error('Order tracking fetch error:', err);

        if (!isMounted) return;
        setError('Impossible de charger le suivi de votre commande.');
      } finally {
        // eslint-disable-next-line no-unsafe-finally
        if (!isMounted) return;
        setLoading(false);
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const currentStatusLabel = useMemo(() => {
    if (!orderData) return '';
    return STATUS_LABELS[orderData.status] || orderData.status;
  }, [orderData]);

  const currentStatusDescription = useMemo(() => {
    if (!orderData) return '';
    return getStatusDescription(orderData.status, orderData.fulfillmentMethod);
  }, [orderData]);

  const currentStatusIcon = useMemo(() => {
    if (!orderData) return <Clock className="h-8 w-8 text-primary" />;

    switch (orderData.status) {
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-primary" />;
      case 'in_delivery':
        return <Truck className="h-8 w-8 text-primary" />;
      case 'ready':
        return orderData.fulfillmentMethod === 'pickup'
          ? <Store className="h-8 w-8 text-primary" />
          : <CheckCircle className="h-8 w-8 text-primary" />;
      case 'cancelled':
      case 'payment_failed':
        return <XCircle className="h-8 w-8 text-destructive" />;
      default:
        return <Clock className="h-8 w-8 text-primary" />;
    }
  }, [orderData]);

  if (loading) {
    return (
      <ClientLayout>
        <div className="container py-20 max-w-lg text-center">
          <h1 className="font-display text-2xl font-bold">Suivi de commande</h1>
          <p className="text-muted-foreground mt-2">
            Chargement du suivi de votre commande...
          </p>
        </div>
      </ClientLayout>
    );
  }

  if (error || !orderData) {
    return (
      <ClientLayout>
        <div className="container py-20 max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <XCircle className="h-8 w-8 text-muted-foreground" />
          </div>

          <h1 className="font-display text-2xl font-bold mt-6">Suivi indisponible</h1>
          <p className="text-muted-foreground mt-2">{error || 'Commande introuvable.'}</p>

          <div className="mt-8 flex justify-center">
            <Button asChild>
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="container py-16 max-w-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            {currentStatusIcon}
          </div>

          <h1 className="font-display text-3xl font-bold mt-6">Suivi de commande</h1>

          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Consultez ici l’état actuel de votre commande.
          </p>
        </div>

        <div className="card-premium p-5 mt-8 text-left space-y-3">
          <div className="flex justify-between gap-4">
            <span className="text-sm text-muted-foreground">N° de commande</span>
            <span className="text-sm font-semibold text-primary text-right">{orderData.orderNumber}</span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-sm text-muted-foreground">Statut actuel</span>
            <span className="text-sm font-medium text-right">{currentStatusLabel}</span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-sm text-muted-foreground">Mode</span>
            <span className="text-sm font-medium text-right">
              {orderData.fulfillmentMethod === 'pickup' ? 'Retrait sur place' : 'Livraison'}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-sm text-muted-foreground">Commande créée</span>
            <span className="text-sm font-medium text-right">{formatDateTime(orderData.createdAt)}</span>
          </div>

          {orderData.paidAt && (
            <div className="flex justify-between gap-4">
              <span className="text-sm text-muted-foreground">Paiement confirmé</span>
              <span className="text-sm font-medium text-right">{formatDateTime(orderData.paidAt)}</span>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/10 p-5">
          <h2 className="font-medium text-foreground">État actuel</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {currentStatusDescription}
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">Historique</h2>

          <div className="mt-4 space-y-4">
            {orderData.statusHistory.map((entry, index) => (
              <div
                key={`${entry.status}-${entry.createdAt}-${index}`}
                className="flex items-start justify-between gap-4 border-b border-border last:border-b-0 pb-4 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {STATUS_LABELS[entry.status] || entry.status}
                  </p>
                </div>

                <p className="text-sm text-muted-foreground text-right whitespace-nowrap">
                  {formatDateTime(entry.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild>
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    </ClientLayout>
  );
}