import { useCart } from '@/contexts/CartContext';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: Props) {
  const { items, mode, setMode, subtotal, deliveryFee, total, removeItem, updateQuantity, meetsMinimum, minimumOrder, clearCart } = useCart();
  const navigate = useNavigate();

  const goToCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  return (
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 z-40 bg-espresso/30 backdrop-blur-sm" onClick={onClose} />}

      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform border-l border-border/40 bg-card shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 p-4">
            <h2 className="font-display text-lg font-semibold">Votre panier</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
          </div>

          {/* Mode selector */}
          <div className="flex border-b border-border/40 bg-background/50">
            {(['livraison', 'retrait'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  mode === m ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'livraison' ? '🛵 Livraison' : '🏠 Retrait'}
              </button>
            ))}
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Votre panier est vide.</p>
            ) : (
              items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-background/60 border border-border/30 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type === 'pates' ? SIZE_LABELS[item.size] : SIZE_LABELS[item.formula]}
                      {item.type === 'paninis' && item.beverageName && ` + ${item.beverageName}`}
                    </p>
                    <p className="text-sm font-bold text-primary mt-1">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQuantity(i, item.quantity - 1)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:border-primary/40 transition-colors">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(i, item.quantity + 1)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:border-primary/40 transition-colors">
                      <Plus className="h-3 w-3" />
                    </button>
                    <button onClick={() => removeItem(i)} className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          {items.length > 0 && (
            <div className="border-t border-border/40 p-4 space-y-3 bg-background/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              {mode === 'livraison' && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Livraison</span>
                  <span className="font-medium">{formatPrice(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-border/30">
                <span>Total</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
              {!meetsMinimum && mode === 'livraison' && (
                <p className="text-xs text-destructive">Minimum de commande : {formatPrice(minimumOrder)} pour la livraison.</p>
              )}
              <Button onClick={goToCheckout} disabled={!meetsMinimum} className="w-full glow-primary font-bold">
                Commander · {formatPrice(total)}
              </Button>
              <button onClick={clearCart} className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors">
                Vider le panier
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
