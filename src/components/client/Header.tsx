import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { SITE_CONFIG } from '@/config/menu';

export default function Header() {
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-card/85 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="font-display text-xl font-bold text-primary hover:text-terracotta-dark transition-colors">
          {SITE_CONFIG.restaurantName}
        </Link>

        <nav className="flex items-center gap-6">
          <Link to="/commander" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Commander
          </Link>
          <Link to="/commander" className="relative group">
            <ShoppingBag className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                {itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
