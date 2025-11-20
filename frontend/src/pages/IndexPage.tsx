import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Container,
  Link as MuiLink,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Fade,
  Fab,
  Typography,
} from "@mui/material";
import Masonry from "react-masonry-css";
import SortIcon from "@mui/icons-material/Sort";
import GridViewIcon from "@mui/icons-material/GridView";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import FolderIcon from "@mui/icons-material/Folder";
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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "folders">("grid");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderListing, setFolderListing] = useState<MediaFolderListing | null>(
    null
  );
  const [isFolderLoading, setIsFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

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

  const folderParam = viewMode === "folders" ? currentFolder ?? "" : null;
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
      sx={{ 
        minHeight: "100vh", 
        py: 4,
        px: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={2}
        mb={4}
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: "background.paper",
          boxShadow: (theme) => theme.shadows[1],
          backdropFilter: "blur(12px)",
          background: (theme) => 
            `linear-gradient(to right bottom, ${theme.palette.background.paper}, ${theme.palette.background.default})`,
        }}
      >
        <ToggleButtonGroup
          size="medium"
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          aria-label="View mode"
          sx={{ 
            '& .MuiToggleButton-root': { 
                border: 'none',
                borderRadius: 2,
                mx: 0.5,
                px: 2,
                py: 1,
                '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                        bgcolor: 'primary.dark',
                    }
                }
            } 
          }}
        >
          <ToggleButton value="grid" aria-label="grid view" sx={{ gap: 1 }}>
            <GridViewIcon />
            <Typography variant="button" component="span" sx={{ textTransform: 'none' }}>
              Grid
            </Typography>
          </ToggleButton>
          <ToggleButton
            value="folders"
            aria-label="Folder view"
            sx={{ gap: 1 }}
          >
            <FolderIcon fontSize="small" />
            <Typography variant="button" component="span" sx={{ textTransform: 'none' }}>
              Folders
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>

        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
             Sort by:
          </Typography>
          <Button
            onClick={handleSortMenuOpen}
            color="inherit"
            startIcon={<SortIcon />}
            sx={{ 
                bgcolor: 'action.hover',
                borderRadius: 2,
                px: 2,
                color: 'text.primary'
            }}
          >
            Sort by: {sortOrder === "newest" ? "Newest" : "Oldest"}
          </Button>
        </Box>
        <Menu
          anchorEl={sortMenuAnchorEl}
          open={Boolean(sortMenuAnchorEl)}
          onClose={handleSortMenuClose}
          PaperProps={{
              elevation: 2,
              sx: { borderRadius: 2, mt: 1, minWidth: 180 }
          }}
        >
          <MenuItem
            onClick={() => handleSortChange("newest")}
            selected={sortOrder === "newest"}
            sx={{ borderRadius: 1, mx: 1 }}
          >
            Sort by Created At
          </MenuItem>
          <MenuItem
            onClick={() => handleSortChange("latest")}
            selected={sortOrder === "latest"}
            sx={{ borderRadius: 1, mx: 1 }}
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
              startIcon={<KeyboardArrowUpIcon />}
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
      {/* Scroll to Top FAB */}
      <Fade in={showScrollTop}>
        <Box
          onClick={scrollToTop}
          role="presentation"
          sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 100 }}
        >
          <Fab size="small" color="primary" aria-label="scroll back to top">
            <KeyboardArrowUpIcon />
          </Fab>
        </Box>
      </Fade>
    </Container>
  );
}
