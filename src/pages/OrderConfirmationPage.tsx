/* eslint-disable no-unsafe-finally */
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientLayout from '@/components/client/ClientLayout';
import { useCart } from '@/contexts/CartContext';

const CHECKOUT_FORM_STORAGE_KEY = 'pasta-house-checkout-form';

interface OrderConfirmationResponse {
  ok: boolean;
  data?: {
    orderNumber: string;
    status: string;
    paidAt: string | null;
    stripePaymentIntentId: string | null;
    paymentConfirmed: boolean;
    createdAt: string;
  };
  message?: string;
  error?: string;
}

export default function OrderConfirmationPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const orderNumber = params.get('orderNumber') || '';
  const { clearCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!sessionId || !orderNumber) {
        if (!isMounted) return;
        setError('Confirmation de paiement introuvable.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/public/orders/confirmation?session_id=${encodeURIComponent(sessionId)}&orderNumber=${encodeURIComponent(orderNumber)}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          }
        );

        const json = (await response.json()) as OrderConfirmationResponse;

        if (!response.ok || !json.ok || !json.data) {
          throw new Error(json.message || 'Impossible de vérifier la commande.');
        }

        if (!json.data.paymentConfirmed) {
          throw new Error('Le paiement n’est pas encore confirmé.');
        }

        if (!isMounted) return;

        setConfirmedOrderNumber(json.data.orderNumber);
        clearCart();

        try {
          localStorage.removeItem(CHECKOUT_FORM_STORAGE_KEY);
        } catch (storageError) {
          console.error('Failed to clear checkout form from localStorage:', storageError);
        }
      } catch (err) {
        console.error('Order confirmation fetch error:', err);

        if (!isMounted) return;
        setError('Le paiement n’a pas encore pu être confirmé. Vérifiez dans quelques instants depuis l’admin ou réessayez plus tard.');
      } finally {
        if (!isMounted)
          return;
        setLoading(false);
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [sessionId, orderNumber, clearCart]);

  if (loading) {
    return (
      <ClientLayout>
        <div className="container py-20 max-w-lg text-center">
          <h1 className="font-display text-2xl font-bold">Vérification du paiement</h1>
          <p className="text-muted-foreground mt-2">
            Nous vérifions la confirmation de votre commande...
          </p>
        </div>
      </ClientLayout>
    );
  }

  if (error) {
    return (
      <ClientLayout>
        <div className="container py-20 max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <CheckCircle className="h-8 w-8 text-muted-foreground" />
          </div>

          <h1 className="font-display text-2xl font-bold mt-6">Confirmation en attente</h1>

          <p className="text-muted-foreground mt-2">{error}</p>

          {orderNumber && (
            <div className="card-premium p-5 mt-8 text-left space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">N° de commande</span>
                <span className="text-sm font-semibold text-primary">{orderNumber}</span>
              </div>
            </div>
          )}

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
      <div className="container py-20 max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
          <CheckCircle className="h-8 w-8 text-primary" />
        </div>

        <h1 className="font-display text-2xl font-bold mt-6">Paiement confirmé</h1>

        <p className="text-muted-foreground mt-2">
          Merci pour votre commande. Votre paiement a bien été pris en compte.
        </p>

        <div className="card-premium p-5 mt-8 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">N° de commande</span>
            <span className="text-sm font-semibold text-primary">{confirmedOrderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Statut</span>
            <span className="text-sm font-medium">Paiement confirmé</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-6">
          Conservez ce numéro de commande pour le suivi.
        </p>

        <Button asChild className="mt-8">
          <Link to="/">Retour à l'accueil</Link>
        </Button>
      </div>
    </ClientLayout>
  );
}