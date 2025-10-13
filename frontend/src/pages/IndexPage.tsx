import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Link as MuiLink,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import Masonry from "react-masonry-css";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { useListStore, defaultListState } from "../stores/useListStore";
import MediaCard from "../components/MediaCard";
import FolderCard from "../components/FolderCard";
import { getMediaFolders, getMediaList } from "../services/media";
import { useTaskCompletionVersion } from "../TaskEventsContext";
import { MediaFolderListing } from "../types";

const breakpointColumnsObj = {
  default: 5,
  1600: 4,
  1200: 3,
  900: 3,
  600: 2,
};

export default function IndexPage() {
  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });
  const [tags] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"newest" | "latest">("newest");
  const [sortMenuAnchorEl, setSortMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [viewMode, setViewMode] = useState<"grid" | "folders">("grid");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderListing, setFolderListing] = useState<MediaFolderListing | null>(
    null
  );
  const [isFolderLoading, setIsFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  const mediaListKey = useMemo(() => {
    const tagString = [...tags].sort().join(",");
    const folderKey =
      viewMode === "folders" ? `folder:${currentFolder ?? ""}` : "all";
    return `media-${viewMode}-${sortOrder}-${folderKey}-${tagString}`;
  }, [sortOrder, tags, viewMode, currentFolder]);

  const listState = useListStore((state) => state.lists[mediaListKey]);
  const items = listState?.items ?? [];
  const hasMore = listState?.hasMore ?? defaultListState.hasMore;
  const isLoading = listState?.isLoading ?? defaultListState.isLoading;
  const { fetchInitial, loadMore, clearList } = useListStore();
  const refreshKey = useTaskCompletionVersion(["scan", "process_media"]);

  const folderParam = viewMode === "folders" ? currentFolder ?? "" : undefined;
  const recursive = viewMode !== "folders";

  useEffect(() => {
    const controller = new AbortController();
    clearList(mediaListKey);
    fetchInitial(mediaListKey, () =>
      getMediaList(null, sortOrder, tags, folderParam, recursive)
    );
    return () => controller.abort();
  }, [
    mediaListKey,
    fetchInitial,
    sortOrder,
    tags,
    clearList,
    folderParam,
    recursive,
    refreshKey,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    if (inView && hasMore && !isLoading) {
      loadMore(mediaListKey, (cursor) =>
        getMediaList(cursor, sortOrder, tags, folderParam, recursive)
      ).catch(console.error);
    }
    return () => controller.abort();
  }, [
    inView,
    hasMore,
    isLoading,
    loadMore,
    mediaListKey,
    sortOrder,
    tags,
    folderParam,
    recursive,
  ]);

  const loadFolders = useCallback(async () => {
    if (viewMode !== "folders") {
      return;
    }
    setIsFolderLoading(true);
    setFolderError(null);
    try {
      const data = await getMediaFolders(currentFolder ?? null);
      setFolderListing(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load folders";
      setFolderError(message);
    } finally {
      setIsFolderLoading(false);
    }
  }, [viewMode, currentFolder, refreshKey]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const handleSortMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSortMenuAnchorEl(event.currentTarget);
  };
  const handleSortMenuClose = () => {
    setSortMenuAnchorEl(null);
  };
  const handleSortChange = (newSortOrder: "newest" | "latest") => {
    setSortOrder(newSortOrder);
    handleSortMenuClose();
  };

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    nextMode: "grid" | "folders" | null
  ) => {
    if (!nextMode) return;
    setViewMode(nextMode);
    if (nextMode === "folders") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleFolderOpen = useCallback((path: string) => {
    setCurrentFolder(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleBreadcrumbNavigate = useCallback((path: string | null) => {
    setCurrentFolder(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleGoUp = useCallback(() => {
    if (!folderListing) return;
    handleBreadcrumbNavigate(folderListing.parent_path ?? null);
  }, [folderListing, handleBreadcrumbNavigate]);

  const breadcrumbItems = folderListing?.breadcrumbs ?? [];
  const directCount = folderListing?.direct_media_count ?? 0;

  return (
    <Container
      maxWidth="xl"
      sx={{ bgcolor: "background.default", minHeight: "100vh", py: 2 }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1.5}
        mb={2}
      >
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          aria-label="View mode"
        >
          <ToggleButton value="grid" aria-label="Grid view" sx={{ gap: 0.75 }}>
            <ViewComfyIcon fontSize="small" />
            <Typography variant="caption" component="span">
              Grid
            </Typography>
          </ToggleButton>
          <ToggleButton
            value="folders"
            aria-label="Folder view"
            sx={{ gap: 0.75 }}
          >
            <FolderOutlinedIcon fontSize="small" />
            <Typography variant="caption" component="span">
              Folders
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>

        <Box>
          <IconButton
            onClick={handleSortMenuOpen}
            color="primary"
            aria-label="Open sort menu"
          >
            <ImportExportIcon />
          </IconButton>
        </Box>
        <Menu
          anchorEl={sortMenuAnchorEl}
          open={Boolean(sortMenuAnchorEl)}
          onClose={handleSortMenuClose}
        >
          <MenuItem
            onClick={() => handleSortChange("newest")}
            selected={sortOrder === "newest"}
          >
            Sort by Created At
          </MenuItem>
          <MenuItem
            onClick={() => handleSortChange("latest")}
            selected={sortOrder === "latest"}
          >
            Sort by Inserted At
          </MenuItem>
        </Menu>
      </Box>

      {viewMode === "folders" && (
        <>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
            mb={2}
          >
            <Breadcrumbs aria-label="folder breadcrumb" sx={{ flexGrow: 1 }}>
              <MuiLink
                component="button"
                variant="body2"
                onClick={() => handleBreadcrumbNavigate(null)}
                sx={{ color: "inherit", textDecoration: "none" }}
              >
                All media
              </MuiLink>
              {breadcrumbItems.map((crumb, index) => {
                const isLast = index === breadcrumbItems.length - 1;
                const key = crumb.path ?? `${crumb.name}-${index}`;
                if (isLast) {
                  return (
                    <Typography
                      key={key}
                      variant="body2"
                      color="text.primary"
                    >
                      {crumb.name}
                    </Typography>
                  );
                }
                return (
                  <MuiLink
                    key={key}
                    component="button"
                    variant="body2"
                    onClick={() =>
                      handleBreadcrumbNavigate(crumb.path ?? null)
                    }
                    sx={{ color: "inherit", textDecoration: "none" }}
                  >
                    {crumb.name}
                  </MuiLink>
                );
              })}
            </Breadcrumbs>
            <Button
              variant="text"
              size="small"
              startIcon={<ArrowUpwardIcon fontSize="small" />}
              onClick={handleGoUp}
              disabled={!folderListing?.current_path}
            >
              Up one level
            </Button>
          </Box>

          {folderError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {folderError}
            </Alert>
          )}

          {isFolderLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "repeat(auto-fill, minmax(200px, 1fr))",
                    sm: "repeat(auto-fill, minmax(220px, 1fr))",
                    md: "repeat(auto-fill, minmax(240px, 1fr))",
                  },
                  mb:
                    folderListing && folderListing.folders.length > 0
                      ? 2
                      : 0,
                }}
              >
                {folderListing?.folders.map((folder) => (
                  <FolderCard
                    key={folder.path}
                    folder={folder}
                    onOpen={handleFolderOpen}
                  />
                ))}
              </Box>
              {folderListing && folderListing.folders.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  No subfolders in this location.
                </Typography>
              )}
            </>
          )}

          {!isFolderLoading && folderListing && (
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              {directCount
                ? `${directCount} item${
                    directCount === 1 ? "" : "s"
                  } in this folder`
                : "No files directly in this folder"}
            </Typography>
          )}
        </>
      )}

      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
      >
        {items.map((mediaItem) => (
          <div key={mediaItem.id}>
            <MediaCard media={mediaItem} mediaListKey={mediaListKey} />
          </div>
        ))}
      </Masonry>

      {isLoading && (
        <Box textAlign="center" py={3}>
          <CircularProgress />
        </Box>
      )}
      {hasMore && <Box ref={loaderRef} sx={{ height: "10px" }} />}
    </Container>
  );
}
