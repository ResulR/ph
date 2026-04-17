import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientLayout from '@/components/client/ClientLayout';
import { useCart } from '@/contexts/CartContext';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const CHECKOUT_FORM_STORAGE_KEY = 'pasta-house-checkout-form';

type CheckoutFormState = {
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
  commune: string;
  codePostal: string;
  instructions: string;
  note: string;
};

const EMPTY_CHECKOUT_FORM: CheckoutFormState = {
  nom: '',
  telephone: '',
  email: '',
  adresse: '',
  commune: '',
  codePostal: '',
  instructions: '',
  note: '',
};

function normalizePhoneNumber(value: string): string {
  return value.trim().replace(/[()./\-\s]+/g, '');
}

function isValidPhoneNumber(value: string): boolean {
  const normalized = normalizePhoneNumber(value);

  if (!normalized) {
    return false;
  }

  return /^\+?\d{8,15}$/.test(normalized);
}

export default function CheckoutPage() {
  const { items, mode, setMode, subtotal, deliveryFee, total, meetsMinimum, minimumOrder } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const [form, setForm] = useState<CheckoutFormState>(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_FORM_STORAGE_KEY);

      if (!raw) {
        return EMPTY_CHECKOUT_FORM;
      }

      const parsed = JSON.parse(raw);

      return {
        nom: typeof parsed?.nom === 'string' ? parsed.nom : '',
        telephone: typeof parsed?.telephone === 'string' ? parsed.telephone : '',
        email: typeof parsed?.email === 'string' ? parsed.email : '',
        adresse: typeof parsed?.adresse === 'string' ? parsed.adresse : '',
        commune: typeof parsed?.commune === 'string' ? parsed.commune : '',
        codePostal: typeof parsed?.codePostal === 'string' ? parsed.codePostal : '',
        instructions: typeof parsed?.instructions === 'string' ? parsed.instructions : '',
        note: typeof parsed?.note === 'string' ? parsed.note : '',
      };
    } catch (error) {
      console.error('Failed to restore checkout form from localStorage:', error);
      return EMPTY_CHECKOUT_FORM;
    }
  });

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

    useEffect(() => {
    try {
      localStorage.setItem(CHECKOUT_FORM_STORAGE_KEY, JSON.stringify(form));
    } catch (error) {
      console.error('Failed to persist checkout form to localStorage:', error);
    }
  }, [form]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.nom.trim()) errs.nom = 'Requis';
    if (!form.telephone.trim()) {
      errs.telephone = 'Requis';
    } else if (!isValidPhoneNumber(form.telephone)) {
      errs.telephone = 'Numéro invalide';
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email invalide';
    if (mode === 'livraison') {
      if (!form.adresse.trim()) errs.adresse = 'Requis';
      if (!form.commune.trim()) errs.commune = 'Requis';
      if (!form.codePostal.trim()) errs.codePostal = 'Requis';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError('');

    if (!validate()) return;
    if (!meetsMinimum) return;
    if (items.length === 0) return;

    setLoading(true);

    try {
      const response = await fetch('/api/public/checkout/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          mode,
          items,
          customer: {
            nom: form.nom,
            telephone: form.telephone,
            email: form.email,
            adresse: form.adresse,
            commune: form.commune,
            codePostal: form.codePostal,
            instructions: form.instructions,
            note: form.note,
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok || !json?.data?.checkoutUrl) {
        const backendMessage =
          json?.message ||
          json?.details?.[0]?.message ||
          'Impossible de lancer le paiement pour le moment.';

        setSubmitError(backendMessage);
        return;
      }

      window.location.href = json.data.checkoutUrl;
      return;
    } catch (error) {
      console.error('Checkout submit error:', error);
      setSubmitError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <ClientLayout>
        <div className="container py-20 text-center">
          <h1 className="font-display text-2xl font-semibold">Panier vide</h1>
          <p className="text-muted-foreground mt-2">Ajoutez des articles avant de passer commande.</p>
          <Button onClick={() => navigate('/commander')} className="mt-6">Voir la carte</Button>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="container py-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Finaliser la commande</h1>

        {/* Mode */}
        <div className="mt-6 flex rounded-xl bg-muted p-1">
          {(['livraison', 'retrait'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {m === 'livraison' ? '🛵 Livraison' : '🏠 Retrait'}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 card-premium p-4 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Récapitulatif</h2>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {item.quantity}× {item.productName}
                <span className="text-muted-foreground ml-1">
                  ({item.type === 'pates' ? SIZE_LABELS[item.size] : SIZE_LABELS[item.formula]}
                  {item.type === 'paninis' && item.beverageName && ` + ${item.beverageName}`})
                </span>
              </span>
              <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {mode === 'livraison' && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Livraison</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
          </div>
        </div>

        {!meetsMinimum && mode === 'livraison' && (
          <p className="mt-3 text-sm text-destructive">Minimum de commande en livraison : {formatPrice(minimumOrder)}</p>
        )}

        {/* Form */}
        <div className="mt-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">Vos coordonnées</h2>

          <div>
            <Label htmlFor="nom">Nom *</Label>
            <Input id="nom" value={form.nom} onChange={e => update('nom', e.target.value)} placeholder="Votre nom" />
            {errors.nom && <p className="text-xs text-destructive mt-1">{errors.nom}</p>}
          </div>
          <div>
            <Label htmlFor="telephone">Téléphone *</Label>
            <Input id="telephone" type="tel" value={form.telephone} onChange={e => update('telephone', e.target.value)} placeholder="0470 12 34 56" />
            {errors.telephone && <p className="text-xs text-destructive mt-1">{errors.telephone}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="vous@exemple.com" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          {mode === 'livraison' && (
            <>
              <div>
                <Label htmlFor="adresse">Adresse *</Label>
                <Input id="adresse" value={form.adresse} onChange={e => update('adresse', e.target.value)} placeholder="Rue, numéro" />
                {errors.adresse && <p className="text-xs text-destructive mt-1">{errors.adresse}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="commune">Commune *</Label>
                  <Input id="commune" value={form.commune} onChange={e => update('commune', e.target.value)} placeholder="Bruxelles" />
                  {errors.commune && <p className="text-xs text-destructive mt-1">{errors.commune}</p>}
                </div>
                <div>
                  <Label htmlFor="codePostal">Code postal *</Label>
                  <Input id="codePostal" value={form.codePostal} onChange={e => update('codePostal', e.target.value)} placeholder="1000" />
                  {errors.codePostal && <p className="text-xs text-destructive mt-1">{errors.codePostal}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="instructions">Instructions de livraison</Label>
                <Textarea id="instructions" value={form.instructions} onChange={e => update('instructions', e.target.value)} placeholder="Étage, code d'entrée, etc." rows={2} />
              </div>
            </>
          )}

          {mode === 'retrait' && (
            <div>
              <Label htmlFor="note">Note</Label>
              <Textarea id="note" value={form.note} onChange={e => update('note', e.target.value)} placeholder="Remarque particulière..." rows={2} />
            </div>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={loading || !meetsMinimum} className="w-full mt-8 glow-primary" size="lg">
          {loading ? 'Redirection vers le paiement...' : `Payer ${formatPrice(total)}`}
        </Button>

        {submitError && (
          <p className="text-sm text-destructive text-center mt-3">{submitError}</p>
        )}

        <p className="text-xs text-muted-foreground text-center mt-3">
          Paiement sécurisé par Stripe. En commandant, vous acceptez nos{' '}
          <a href="/cgv" className="underline hover:text-primary">CGV</a>.
        </p>
      </div>
    </ClientLayout>
  );
}
