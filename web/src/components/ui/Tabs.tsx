import type { ComponentProps } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('relative inline-flex items-center gap-4 border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 pb-2.5 pt-1',
        'text-sm font-medium text-ink-muted transition-colors duration-100 ease-out-quint',
        'hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('pt-4 outline-hidden', className)} {...props} />;
}
