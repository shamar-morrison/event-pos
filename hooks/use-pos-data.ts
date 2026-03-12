import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  fetchAdminEvents,
  fetchCashiers,
  fetchEventDetail,
  subscribeToAdminEventSummaries,
  subscribeToEventItems,
  subscribeToEventSummary,
} from '@/services/pos-firestore';
import type { AdminEventListItem, CashierUser, EventItem, POSEvent, POSEventSummary } from '@/types/pos';

export const posKeys = {
  root: ['pos'] as const,
  cashiers: (adminId: string) => ['pos', 'admins', adminId, 'cashiers'] as const,
  events: (adminId: string) => ['pos', 'admins', adminId, 'events'] as const,
  cashierEvents: (adminId: string) => ['pos', 'admins', adminId, 'cashier-events'] as const,
  eventDetail: (adminId: string, eventId: string) => ['pos', 'admins', adminId, 'events', eventId, 'detail'] as const,
  eventReport: (adminId: string, eventId: string) => ['pos', 'admins', adminId, 'events', eventId, 'report'] as const,
};

function useRefetchOnFocus(enabled: boolean, refetch: () => Promise<unknown>) {
  const hasMountedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return undefined;
      }

      if (hasMountedRef.current) {
        void refetch();
      } else {
        hasMountedRef.current = true;
      }

      return undefined;
    }, [enabled, refetch])
  );
}

function useRefetchOnAppActive(enabled: boolean, refetch: () => Promise<unknown>) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refetch();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, refetch]);
}

function mergeEventSummaries(
  liveEvents: POSEventSummary[],
  previousEvents?: AdminEventListItem[]
): AdminEventListItem[] {
  const itemCountById = new Map(previousEvents?.map((event) => [event.eventId, event.itemCount]) ?? []);

  return liveEvents.map((event) => ({
    ...event,
    itemCount: itemCountById.get(event.eventId) ?? 0,
  }));
}

function mergeEventSummaryIntoDetail(current: POSEvent | null | undefined, next: POSEventSummary | null): POSEvent | null {
  if (!next) {
    return null;
  }

  return {
    ...next,
    items: current?.items ?? {},
    orders: current?.orders ?? {},
  };
}

function mergeItemsIntoDetail(
  current: POSEvent | null | undefined,
  items: Record<string, EventItem>
): POSEvent | null | undefined {
  if (!current) {
    return current;
  }

  return {
    ...current,
    items,
  };
}

export function useCashiers(adminId?: string | null) {
  return useQuery<CashierUser[]>({
    queryKey: adminId ? posKeys.cashiers(adminId) : ['pos', 'cashiers', 'disabled'],
    queryFn: () => fetchCashiers(adminId as string),
    enabled: !!adminId,
  });
}

export function useAdminEvents(adminId?: string | null, options?: { realtime?: boolean }) {
  const queryClient = useQueryClient();
  const realtime = options?.realtime ?? false;
  const query = useQuery<AdminEventListItem[]>({
    queryKey: adminId ? posKeys.events(adminId) : ['pos', 'events', 'disabled'],
    queryFn: () => fetchAdminEvents(adminId as string),
    enabled: !!adminId,
  });

  useFocusEffect(
    useCallback(() => {
      if (!adminId || !realtime) {
        return undefined;
      }

      return subscribeToAdminEventSummaries(adminId, {
        onData: (events) => {
          queryClient.setQueryData<AdminEventListItem[] | undefined>(
            posKeys.events(adminId),
            (current) => mergeEventSummaries(events, current)
          );
        },
        onError: (error) => {
          console.error('[Queries] Failed to listen for admin events:', error);
        },
      });
    }, [adminId, queryClient, realtime])
  );

  return query;
}

export function useAdminEventDetail(adminId?: string | null, eventId?: string | null) {
  const queryClient = useQueryClient();
  const enabled = !!adminId && !!eventId;
  const query = useQuery<POSEvent | null>({
    queryKey: enabled ? posKeys.eventDetail(adminId as string, eventId as string) : ['pos', 'event-detail', 'disabled'],
    queryFn: () => fetchEventDetail(adminId as string, eventId as string),
    enabled,
  });

  useFocusEffect(
    useCallback(() => {
      if (!adminId || !eventId) {
        return undefined;
      }

      const unsubscribers = [
        subscribeToEventSummary(adminId, eventId, {
          onData: (event) => {
            queryClient.setQueryData<POSEvent | null | undefined>(
              posKeys.eventDetail(adminId, eventId),
              (current) => mergeEventSummaryIntoDetail(current, event)
            );
          },
          onError: (error) => {
            console.error('[Queries] Failed to listen for event detail:', error);
          },
        }),
        subscribeToEventItems(adminId, eventId, {
          onData: (items) => {
            queryClient.setQueryData<POSEvent | null | undefined>(
              posKeys.eventDetail(adminId, eventId),
              (current) => mergeItemsIntoDetail(current, items)
            );
          },
          onError: (error) => {
            console.error('[Queries] Failed to listen for event items:', error);
          },
        }),
      ];

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      };
    }, [adminId, eventId, queryClient])
  );

  return query;
}

export function useAdminEventReport(adminId?: string | null, eventId?: string | null) {
  const queryClient = useQueryClient();
  const enabled = !!adminId && !!eventId;
  const query = useQuery<POSEvent | null>({
    queryKey: enabled ? posKeys.eventReport(adminId as string, eventId as string) : ['pos', 'event-report', 'disabled'],
    queryFn: () => fetchEventDetail(adminId as string, eventId as string, { includeOrders: true }),
    enabled,
  });

  useRefetchOnFocus(enabled, query.refetch);

  useFocusEffect(
    useCallback(() => {
      if (!adminId || !eventId) {
        return undefined;
      }

      return subscribeToEventSummary(adminId, eventId, {
        onData: (event) => {
          queryClient.setQueryData<POSEvent | null | undefined>(
            posKeys.eventReport(adminId, eventId),
            (current) => {
              if (!event) {
                return null;
              }

              return current
                ? {
                    ...current,
                    ...event,
                  }
                : null;
            }
          );
        },
        onError: (error) => {
          console.error('[Queries] Failed to listen for event report:', error);
        },
      });
    }, [adminId, eventId, queryClient])
  );

  return query;
}

export function useCashierEvents(adminId?: string | null) {
  const query = useQuery<AdminEventListItem[]>({
    queryKey: adminId ? posKeys.cashierEvents(adminId) : ['pos', 'cashier-events', 'disabled'],
    queryFn: async () => {
      const events = await fetchAdminEvents(adminId as string);
      return events.filter((event) => event.status === 'live');
    },
    enabled: !!adminId,
  });

  useRefetchOnFocus(!!adminId, query.refetch);
  useRefetchOnAppActive(!!adminId, query.refetch);

  return query;
}

export function useCashierEventDetail(adminId?: string | null, eventId?: string | null) {
  const enabled = !!adminId && !!eventId;
  const query = useQuery<POSEvent | null>({
    queryKey: enabled ? posKeys.eventDetail(adminId as string, eventId as string) : ['pos', 'cashier-event-detail', 'disabled'],
    queryFn: () => fetchEventDetail(adminId as string, eventId as string),
    enabled,
  });

  useRefetchOnFocus(enabled, query.refetch);
  useRefetchOnAppActive(enabled, query.refetch);

  return query;
}
