import React, { useState, useMemo, useEffect } from "react";
import Masonry from "react-masonry-css";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import { useInView } from "react-intersection-observer";

import MediaCard from "../components/MediaCard";
import {
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Container,
} from "@mui/material";
import { useListStore, defaultListState } from "../stores/useListStore";
import { getVideos } from "../services/media";
import { useTaskCompletionVersion } from "../TaskEventsContext";

const breakpointColumnsObj = {
  default: 5,
  1600: 4,
  1200: 3,
  900: 3,
  600: 2,
};

export default function VideosPage() {
  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });
  const [sortOrder, setSortOrder] = useState<"newest" | "latest">("newest");
  const [sortMenuAnchorEl, setSortMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );

  const listKey = useMemo(() => `videos-${sortOrder}`, [sortOrder]);
  const { items, hasMore, isLoading } = useListStore(
    (state) => state.lists[listKey] || defaultListState
  );
  const { fetchInitial, loadMore, clearList } = useListStore();
  const refreshKey = useTaskCompletionVersion(["scan", "process_media"]);

  useEffect(() => {
    clearList(listKey);
    fetchInitial(listKey, () => getVideos(null, sortOrder));
  }, [listKey, fetchInitial, sortOrder, clearList, refreshKey]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore(listKey, (cursor) => getVideos(cursor, sortOrder));
    }
  }, [inView, hasMore, isLoading, loadMore, listKey, sortOrder]); // Add listKey and sortOr

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

  return (
    <>
      <Container
        maxWidth="xl"
        sx={{
          bgcolor: "background.default",
          color: "text.primary",
          minHeight: "100vh",
          py: 2,
        }}
      >
        <Box
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          mb={2}
        >
          <IconButton onClick={handleSortMenuOpen} sx={{ color: "primary" }}>
            <ImportExportIcon />
          </IconButton>
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

        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="my-masonry-grid"
          columnClassName="my-masonry-grid_column"
        >
          {items.map((media) => (
            <div key={media.id}>
              <MediaCard media={media} mediaListKey={listKey} />
            </div>
          ))}
        </Masonry>

        {/* Loading / Sentinel */}
        {isLoading && (
          <Box textAlign="center" py={3}>
            <CircularProgress sx={{ color: "accent.main" }} />
          </Box>
        )}
        {hasMore && <Box ref={loaderRef} />}
      </Container>
    </>
  );
}
