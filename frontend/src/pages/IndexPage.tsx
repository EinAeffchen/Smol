import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import {
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Container,
} from "@mui/material";
import Masonry from "react-masonry-css";
import ImportExportIcon from "@mui/icons-material/ImportExport";

import { useMediaStore, defaultListState } from "../stores/useMediaStore";
import MediaCard from "../components/MediaCard";
import { API } from "../config";

const breakpointColumnsObj = {
  default: 5,
  1600: 4,
  1200: 3,
  900: 3,
  600: 2,
};

export default function IndexPage() {
  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });
  const [tags, setTags] = useState<string[]>([]); // Assuming you will add a tag filter UI
  const [sortOrder, setSortOrder] = useState<"newest" | "latest">("newest");
  const [sortMenuAnchorEl, setSortMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );

  const baseUrl = useMemo(() => {
    const params = new URLSearchParams({ sort: sortOrder });
    tags.forEach((tag) => params.append("tags", tag));
    return `${API}/api/media/?${params.toString()}`;
  }, [sortOrder, tags]);

  const { items, hasMore, isLoading } = useMediaStore(
    (state) => state.lists[baseUrl] || defaultListState
  );
  const { fetchInitial, loadMore } = useMediaStore();

  useEffect(() => {
    fetchInitial(baseUrl);
  }, [baseUrl, fetchInitial]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore(baseUrl);
    }
  }, [inView, hasMore, isLoading, loadMore, baseUrl]);

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
    <Container
      maxWidth="xl"
      sx={{ bgcolor: "background.default", minHeight: "100vh", py: 2 }}
    >
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={2}>
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
            <MediaCard
              media={media}
              mediaListKey={baseUrl}
              sortOrder={sortOrder}
            />
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
