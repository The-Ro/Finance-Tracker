import {
  ArrowLeftRight,
  Award,
  Baby,
  Briefcase,
  Building2,
  Car,
  CircleHelp,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PawPrint,
  Percent,
  Plane,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Undo2,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'
import { resolveCategoryIcon, type CategoryIconKey } from '@/lib/categoryIcon'

const ICONS: Record<CategoryIconKey, LucideIcon> = {
  home: Home,
  bolt: Zap,
  basket: ShoppingBasket,
  dining: UtensilsCrossed,
  car: Car,
  bag: ShoppingBag,
  health: HeartPulse,
  shield: ShieldCheck,
  film: Clapperboard,
  repeat: Repeat,
  education: GraduationCap,
  plane: Plane,
  sparkles: Sparkles,
  gift: Gift,
  receipt: Receipt,
  salary: Briefcase,
  laptop: Laptop,
  percent: Percent,
  trending: TrendingUp,
  building: Building2,
  award: Award,
  refund: Undo2,
  wallet: Wallet,
  review: CircleHelp,
  transfer: ArrowLeftRight,
  loan: Landmark,
  fuel: Fuel,
  phone: Smartphone,
  wifi: Wifi,
  coffee: Coffee,
  pet: PawPrint,
  baby: Baby,
  fitness: Dumbbell,
  tag: Tag,
}

/** The icon for a transaction's category: the user's chosen one (`iconKey`), else guessed from the name. */
export function CategoryIcon({
  category,
  type,
  iconKey,
  ...props
}: { category: string | null | undefined; type?: string; iconKey?: string | null } & LucideProps) {
  const Icon = ICONS[resolveCategoryIcon(category, type, iconKey)]
  return <Icon aria-hidden="true" {...props} />
}

/** One icon by key (the Settings icon picker). */
export function CategoryIconByKey({ iconKey, ...props }: { iconKey: CategoryIconKey } & LucideProps) {
  const Icon = ICONS[iconKey]
  return <Icon aria-hidden="true" {...props} />
}
