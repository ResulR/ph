import { useMemo, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { Product, PastaVariant, PaniniVariant, CartItemPasta, CartItemPanini, Beverage } from '@/types';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

interface Props {
  product: Product;
  categorySlug: 'pates' | 'paninis';
  beverages: Beverage[];
}

export default function ProductCard({ product, categorySlug, beverages }: Props) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedBeverageId, setSelectedBeverageId] = useState('');
  const [showBeverageError, setShowBeverageError] = useState(false);

  const activeVariants = product.variants.filter(v => v.active);
  const activeBeverages = useMemo(
    () => beverages.filter((beverage) => beverage.active).sort((a, b) => a.order - b.order),
    [beverages],
  );
  const currentVariant = activeVariants[selectedVariantIndex];
  if (!currentVariant) return null;

  const isPaniniMenu = categorySlug === 'paninis' && (currentVariant as PaniniVariant).formula === 'menu';


  const handleAdd = () => {
    if (isPaniniMenu && !selectedBeverageId) {
      setShowBeverageError(true);
      return;
    }
    setShowBeverageError(false);

    if (categorySlug === 'pates') {
      const v = currentVariant as PastaVariant;
      const item: CartItemPasta = {
        type: 'pates',
        productId: product.id,
        productName: product.name,
        size: v.size,
        price: v.price,
        quantity,
      };
      addItem(item);
    } else {
      const v = currentVariant as PaniniVariant;
      const bev = beverages.find(b => b.id === selectedBeverageId);
      const item: CartItemPanini = {
        type: 'paninis',
        productId: product.id,
        productName: product.name,
        formula: v.formula,
        price: v.price,
        quantity,
        beverageId: v.formula === 'menu' ? selectedBeverageId : undefined,
        beverageName: v.formula === 'menu' ? bev?.name : undefined,
      };
      addItem(item);
    }
    setQuantity(1);
    setSelectedBeverageId('');
  };

  const getVariantLabel = (v: PastaVariant | PaniniVariant) => {
    if ('size' in v) return SIZE_LABELS[v.size];
    return SIZE_LABELS[v.formula];
  };

  return (
    <div className="card-premium p-5 flex flex-col gap-3 animate-fade-in group">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-200">{product.name}</h3>
          {product.featured && (
            <span className="shrink-0 rounded-full bg-olive/15 px-2.5 py-0.5 text-xs font-semibold text-olive">
              Populaire
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{product.description}</p>
      </div>

      {/* Variant selector */}
      <div className="flex gap-2">
        {activeVariants.map((v, i) => {
          const label = getVariantLabel(v);
          return (
            <button
              key={i}
              onClick={() => { setSelectedVariantIndex(i); setSelectedBeverageId(''); setShowBeverageError(false); }}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all duration-200 ${
                i === selectedVariantIndex
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-background/50 text-muted-foreground hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <div>{label}</div>
              <div className="text-xs font-bold mt-0.5">{formatPrice(v.price)}</div>
            </button>
          );
        })}
      </div>

      {/* Beverage selector for panini menu */}
      {isPaniniMenu && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Boisson incluse *</p>

          <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-background/30 p-2">
            <div className="grid grid-cols-2 gap-2">
              {activeBeverages.map((beverage) => (
                <button
                  key={beverage.id}
                  type="button"
                  onClick={() => {
                    setSelectedBeverageId(beverage.id);
                    setShowBeverageError(false);
                  }}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium text-left transition-all duration-200 ${
                    selectedBeverageId === beverage.id
                      ? 'border-olive bg-olive/10 text-olive shadow-sm'
                      : 'border-border bg-background/50 text-muted-foreground hover:border-olive/40'
                  }`}
                >
                  {beverage.name}
                </button>
              ))}
            </div>
          </div>

          {activeBeverages.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Aucune boisson disponible pour le moment.
            </p>
          )}

          {showBeverageError && (
            <p className="text-xs text-destructive mt-2">Veuillez choisir une boisson.</p>
          )}
        </div>
      )}

      {/* Quantity + Add */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
        <div className="flex items-center gap-2">
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all duration-200">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-6 text-center text-sm font-bold">{quantity}</span>
          <button onClick={() => setQuantity(quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all duration-200">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <Button onClick={handleAdd} size="sm" className="glow-primary-sm font-bold">
          Ajouter · {formatPrice(currentVariant.price * quantity)}
        </Button>
      </div>
    </div>
  );
}
