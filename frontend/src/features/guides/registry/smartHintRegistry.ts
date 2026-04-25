import type { ComponentType } from 'react';
import type { RouteKey } from '../types/guide.types';

export type SmartHintResolver = ComponentType<Record<string, never>>;

const resolvers = new Map<RouteKey, SmartHintResolver>();

export function registerSmartHintResolver(routeKey: RouteKey, Component: SmartHintResolver): void {
  resolvers.set(routeKey, Component);
}

export function getSmartHintResolver(routeKey: RouteKey | null): SmartHintResolver | null {
  if (!routeKey) return null;
  return resolvers.get(routeKey) ?? null;
}

export function __resetSmartHintRegistry(): void {
  resolvers.clear();
}
