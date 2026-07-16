import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListGames,
  useCreateGame,
  useUpdateGame,
  useDeleteGame,
  getListGamesQueryKey,
} from "@workspace/api-client-react";
import type { Game, GameStatus, Platform } from "@/domain/games/types";
import { formatApiError } from "@/lib/apiErrors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameFormData {
  title: string;
  coverUrl: string;
  platform: Platform;
  status: GameStatus;
}

export interface GameMutations {
  addGame: (data: GameFormData) => Promise<void>;
  editGame: (id: string, data: GameFormData) => Promise<void>;
  toggleGameStatus: (id: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
}

interface GamesContextValue {
  games: Game[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  mutations: GameMutations;
}

const GamesContext = createContext<GamesContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GamesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useListGames();

  const games = useMemo<Game[]>(() => {
    const apiGames = data?.games ?? [];
    return apiGames.map((apiGame) => ({
      ...apiGame,
      coverUrl: apiGame.coverUrl ?? "",
      accountCount: apiGame.accountCount ?? 0,
    }));
  }, [data]);

  // Promise-based locks. Returning the in-flight promise means a rapid second
  // click never looks successful; it simply awaits the same request.
  // Each lock is cleared in a `finally` block inside the same promise so the
  // cleanup lifecycle is explicit and no detached rejected promise is created.
  const createPromiseRef = useRef<Promise<void> | null>(null);
  const updatePromiseRef = useRef<Promise<void> | null>(null);
  const deletePromiseRef = useRef<Promise<void> | null>(null);

  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const deleteGameMutation = useDeleteGame();

  // Helper: wait for the active Games list query to refetch before resolving.
  // This ensures the caller can safely close the modal/dialog after synchronization.
  const syncGamesList = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: getListGamesQueryKey(), type: "active" });
  }, [queryClient]);

  const addGame = useCallback(
    async (data: GameFormData) => {
      if (createPromiseRef.current) return createPromiseRef.current;

      const promise = (async () => {
        try {
          const payload: {
            title: string;
            platform: Platform;
            status: GameStatus;
            coverUrl?: string;
          } = {
            title: data.title.trim(),
            platform: data.platform,
            status: data.status,
          };

          if (data.coverUrl.trim()) {
            payload.coverUrl = data.coverUrl.trim();
          }

          await createGame.mutateAsync({ data: payload });
          await syncGamesList();
        } catch (err) {
          throw new Error(formatApiError(err));
        } finally {
          createPromiseRef.current = null;
        }
      })();

      createPromiseRef.current = promise;
      return promise;
    },
    [createGame, syncGamesList],
  );

  const editGame = useCallback(
    async (id: string, data: GameFormData) => {
      if (updatePromiseRef.current) return updatePromiseRef.current;

      const promise = (async () => {
        try {
          const payload = {
            title: data.title.trim(),
            platform: data.platform,
            status: data.status,
            coverUrl: data.coverUrl.trim() ? data.coverUrl.trim() : null,
          };

          await updateGame.mutateAsync({ id, data: payload });
          await syncGamesList();
        } catch (err) {
          throw new Error(formatApiError(err));
        } finally {
          updatePromiseRef.current = null;
        }
      })();

      updatePromiseRef.current = promise;
      return promise;
    },
    [updateGame, syncGamesList],
  );

  const toggleGameStatus = useCallback(
    async (id: string) => {
      const game = games.find((g) => g.id === id);
      if (!game) return;

      if (updatePromiseRef.current) return updatePromiseRef.current;

      const promise = (async () => {
        try {
          const nextStatus = game.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
          await updateGame.mutateAsync({ id, data: { status: nextStatus } });
          await syncGamesList();
        } catch (err) {
          throw new Error(formatApiError(err));
        } finally {
          updatePromiseRef.current = null;
        }
      })();

      updatePromiseRef.current = promise;
      return promise;
    },
    [games, updateGame, syncGamesList],
  );

  const deleteGame = useCallback(
    async (id: string) => {
      if (deletePromiseRef.current) return deletePromiseRef.current;

      const promise = (async () => {
        try {
          await deleteGameMutation.mutateAsync({ id });
          await syncGamesList();
        } catch (err) {
          throw new Error(formatApiError(err, { operation: "delete" }));
        } finally {
          deletePromiseRef.current = null;
        }
      })();

      deletePromiseRef.current = promise;
      return promise;
    },
    [deleteGameMutation, syncGamesList],
  );

  return (
    <GamesContext.Provider
      value={{
        games,
        isLoading,
        isError,
        error,
        refetch,
        mutations: { addGame, editGame, toggleGameStatus, deleteGame },
      }}
    >
      {children}
    </GamesContext.Provider>
  );
}

export function useGames(): GamesContextValue {
  const ctx = useContext(GamesContext);
  if (!ctx) throw new Error("useGames must be used inside <GamesProvider>");
  return ctx;
}
