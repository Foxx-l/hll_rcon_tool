import { useMemo, useState } from "react";
import { cmd } from "@/utils/fetchUtils";
import { columns as playersColumns } from "./players-columns";
import { Header } from "@/components/game/Header";
import { extractPlayers, extractTeamState } from "@/utils/extractPlayers";
import { useLoaderData } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PlayersTable from "./players-table";
import LogsTable from "./logs-table";
import { logsColumns } from "./logs-columns";
import {
  useLogsSearchStore,
  usePlayersTableStore,
  useLogsTableStore,
  useLiveViewLayoutStore,
  LIVE_VIEW_DEFAULT_PLAYERS_WIDTH,
} from "@/stores/table-config";
import ResizableSplit from "./resizable-split";
import { teamsLiveQueryOptions } from "@/queries/teams-live-query";
import { normalizePlayerProfile } from "@/utils/lib";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Grid from "@mui/material/Grid2";
import InfoPanel from "./info-panel";
import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { DebouncedSearchInput } from "@/components/shared/DebouncedSearchInput";
import DisbandSquadDialog from "@/features/player-action/DisbandSquad";
import MessageAllDialog from "@/features/player-action/MessageAll";

const interval = 15 * 1000; // 15 seconds
const UNASSIGNED = "unassigned";

export const loader = async () => {
  const response = await cmd.GET_LIVE_LOGS({
    payload: {
      end: 250,
      filter_action: [],
      filter_player: [],
      inclusive_filter: true,
    },
  });

  return { initialLogsView: response };
};

const Live = () => {
  // ---------------- VIEW STATE -----------------
  const { initialLogsView } = useLoaderData();
  const [globalFilter, setGlobalFilter] = useState([]);

  // ---------------- PLAYERS DATA -----------------
  const { data: teamData, isFetching: isTeamFetching } = useQuery({
    ...teamsLiveQueryOptions,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });

  // const teamData = teamViewResponse.result;

  const playersData = useMemo(() => {
    if (!teamData) return [];
    return extractPlayers(teamData).map((player) => ({
      ...player,
      profile: normalizePlayerProfile(player.profile),
    }));
  }, [teamData]);

  // ---------------- LOGS DATA -----------------
  const logsSearchParams = useLogsSearchStore();
  const setSearchParams = useLogsSearchStore((state) => state.setSearchParams);

  const { data: logsView, isFetching: isLogsFetching } = useQuery({
    queryKey: [
      "logs",
      "live",
      {
        end: logsSearchParams.limit,
        filter_action: logsSearchParams.enabled ? logsSearchParams.actions : [],
        filter_player: logsSearchParams.enabled ? logsSearchParams.players : [],
        inclusive_filter: logsSearchParams.inclusive_filter,
      },
    ],
    queryFn: () =>
      cmd.GET_LIVE_LOGS({
        payload: {
          end: logsSearchParams.limit,
          filter_action: logsSearchParams.enabled
            ? logsSearchParams.actions
            : [],
          filter_player: logsSearchParams.enabled
            ? logsSearchParams.players
            : [],
          inclusive_filter: logsSearchParams.inclusive_filter,
        },
      }),
    select: (response) => response.result,
    initialData: initialLogsView,
    refetchInterval: interval, // Polling interval for updates
  });

  // ---------------- GAME HEADER DATA -----------------
  const { data: gameState } = useQuery({
    queryKey: ["game", "state"],
    queryFn: cmd.GET_GAME_STATE,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });

  const gameData = useMemo(() => {
    if (gameState && teamData) {
      return {
        ...gameState,
        allies: {
          ...extractTeamState(teamData?.allies ?? {}),
          ...(teamData?.allies ?? {}),
        },
        axis: {
          ...extractTeamState(teamData?.axis ?? {}),
          ...(teamData?.axis ?? {}),
        },
        [UNASSIGNED]: {
          ...extractTeamState(teamData?.[UNASSIGNED] ?? {}),
          ...(teamData?.[UNASSIGNED] ?? {}),
        },
      };
    }
    return null;
  }, [gameState, teamData]);

  // ---------------- PLAYERS TABLE STATE -----------------
  const [playersSorting, setPlayersSorting] = useState([
    {
      id: "time",
      desc: true,
    },
  ]);

  const [playersRowSelection, setPlayersRowSelection] = useState({});
  const [playersColumnFilters, setPlayersColumnFilters] = useState([]);
  const playersTableConfig = usePlayersTableStore();
  const setPlayersTableConfig = usePlayersTableStore(
    (state) => state.setConfig
  );

  const playersColumnVisibility = playersTableConfig.columnVisibility;

  const handlePlayersColumnVisibilityChange = (columnId, isVisible) => {
    setPlayersTableConfig((prev) => {
      const columnVisibility = { ...prev.columnVisibility };
      columnVisibility[columnId] === false
        ? delete columnVisibility[columnId]
        : (columnVisibility[columnId] = isVisible);
      return { ...prev, columnVisibility };
    });
  };

  const playersTable = useReactTable({
    data: playersData,
    columns: playersColumns,
    onSortingChange: setPlayersSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setPlayersRowSelection,
    onColumnFiltersChange: setPlayersColumnFilters,
    onColumnVisibilityChange: handlePlayersColumnVisibilityChange,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.player_id,
    state: {
      sorting: playersSorting,
      rowSelection: playersRowSelection,
      columnFilters: playersColumnFilters,
      columnVisibility: playersColumnVisibility,
      globalFilter,
    },
  });

  // ---------------- LOGS TABLE STATE -----------------
  const [logsFiltering, setLogsFiltering] = useState([]);
  const logsTableConfig = useLogsTableStore();
  const setLogsTableConfig = useLogsTableStore((state) => state.setConfig);
  const setPagination = useLogsTableStore((state) => state.setPagination);

  const logsColumnVisibility = logsTableConfig.columnVisibility;

  const handleLogsColumnVisibilityChange = (columnId, isVisible) => {
    setLogsTableConfig((prev) => {
      const columnVisibility = { ...prev.columnVisibility };
      columnVisibility[columnId] === false
        ? delete columnVisibility[columnId]
        : (columnVisibility[columnId] = isVisible);
      return { ...prev, columnVisibility };
    });
  };

  const handleLogsPaginationChange = (updater) => {
    setPagination(updater(logsTableConfig.pagination));
  };

  const logsTable = useReactTable({
    data: logsView.logs,
    columns: logsColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setLogsFiltering,
    onColumnVisibilityChange: handleLogsColumnVisibilityChange,
    onPaginationChange: handleLogsPaginationChange,
    onGlobalFilterChange: setGlobalFilter,
    autoResetPageIndex: false,
    state: {
      columnFilters: logsFiltering,
      columnVisibility: logsColumnVisibility,
      pagination: logsTableConfig.pagination,
      globalFilter,
    },
  });

  const selectedPlayers = useMemo(() => {
    return Object.keys(playersRowSelection)
      .map((key) => {
        return (
          playersTable.getSelectedRowModel().rows.find((row) => row.id === key)
            ?.original ?? null
        );
      })
      .filter(Boolean);
  }, [playersRowSelection, playersTable.getSelectedRowModel().rows]);

  // Add visibility state
  const [visibleElements, setVisibleElements] = useState([
    "players",
    "logs",
    "header",
  ]);

  const handleVisibility = (event, newVisibility) => {
    console.log(newVisibility);
    setVisibleElements(newVisibility);
  };

  const handleSearch = (value) => {
    setGlobalFilter([value]);
  };

  // ---------------- PLAYERS / LOGS SPLIT -----------------
  const isLargeScreen = useMediaQuery((theme) => theme.breakpoints.up("lg"));
  const playersWidth = useLiveViewLayoutStore((state) => state.playersWidth);
  const setPlayersWidth = useLiveViewLayoutStore(
    (state) => state.setPlayersWidth
  );
  const showPlayers = visibleElements.includes("players");
  const showLogs = visibleElements.includes("logs");

  return (
    <Grid container spacing={1} sx={{ width: "100%", minWidth: 0 }}>
      <Grid size={12} sx={{ bgcolor: "background.paper" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <DebouncedSearchInput
            placeholder="Global Search"
            onChange={handleSearch}
          />
          <ToggleButtonGroup
            value={visibleElements}
            onChange={handleVisibility}
            aria-label="visible elements"
            multiple
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                border: "none",
                p: 0.5,
                color: "text.secondary",
                "&.Mui-selected": {
                  bgcolor: "transparent",
                  color: "text.primary",
                },
              },
            }}
          >
            <Tooltip
              title={
                visibleElements.includes("players")
                  ? "Hide Players"
                  : "Show Players"
              }
            >
              <span>
                <ToggleButton value="players">
                  <TableChartIcon
                    sx={{ fontSize: { xs: "1rem", lg: "1.25rem" } }}
                  />
                </ToggleButton>
              </span>
            </Tooltip>
            <Tooltip
              title={
                visibleElements.includes("logs") ? "Hide Logs" : "Show Logs"
              }
            >
              <span>
                <ToggleButton value="logs">
                  <AssessmentIcon
                    sx={{ fontSize: { xs: "1rem", lg: "1.25rem" } }}
                  />
                </ToggleButton>
              </span>
            </Tooltip>
            <Tooltip
              title={
                visibleElements.includes("header")
                  ? "Hide Header"
                  : "Show Header"
              }
            >
              <span>
                <ToggleButton value="header">
                  <ScoreboardIcon
                    sx={{ fontSize: { xs: "1rem", lg: "1.25rem" } }}
                  />
                </ToggleButton>
              </span>
            </Tooltip>
          </ToggleButtonGroup>
        </Stack>
        <InfoPanel gameData={gameData} playersData={playersData} />
        <Stack direction="row" alignItems="center" spacing={1}>
          <MessageAllDialog />
          <DisbandSquadDialog />
        </Stack>
      </Grid>

      {visibleElements.includes("header") && (
        <Grid size={12}>
          <Header data={gameData} />
        </Grid>
      )}

      {(showPlayers || showLogs) && (
        <Grid size={12} sx={{ minWidth: 0 }}>
          <ResizableSplit
            enabled={isLargeScreen && showPlayers && showLogs}
            size={playersWidth}
            onSizeChange={setPlayersWidth}
            defaultSize={LIVE_VIEW_DEFAULT_PLAYERS_WIDTH}
            left={
              showPlayers && (
                <PlayersTable
                  table={playersTable}
                  teamData={teamData}
                  selectedPlayers={selectedPlayers}
                  onColumnVisibilityChange={
                    handlePlayersColumnVisibilityChange
                  }
                  isFetching={isTeamFetching}
                />
              )
            }
            right={
              showLogs && (
                <LogsTable
                  table={logsTable}
                  logsViewData={logsView}
                  searchParams={logsSearchParams}
                  setSearchParams={setSearchParams}
                  onColumnVisibilityChange={handleLogsColumnVisibilityChange}
                  isFetching={isLogsFetching}
                />
              )
            }
          />
        </Grid>
      )}
    </Grid>
  );
};

export default Live;
