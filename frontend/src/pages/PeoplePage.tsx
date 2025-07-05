import React, { useCallback } from "react";
import { useInfinite, CursorResponse } from "../hooks/useInfinite";
import PersonCard from "../components/PersonCard";
import { PersonReadSimple } from "../types";
import {
  Container,
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ENABLE_PEOPLE } from "../config";
import { getPeople } from "../services/person";

export default function PeoplePage() {
  const fetchPeople = useCallback(
    async (cursor?: string): Promise<CursorResponse<PersonReadSimple>> => {
      const data = await getPeople(cursor);
      return { items: data.items, next_cursor: data.next_cursor };
    },
    []
  );

  const {
    items: people,
    hasMore,
    loading,
    loaderRef,
  } = useInfinite<PersonReadSimple>(fetchPeople, []);

  if (loading && people.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }
  if (!ENABLE_PEOPLE) {
    return (
      <Typography variant="h5" color="text.primary" gutterBottom>
        People disabled!
      </Typography>
    );
  }

  return (
    <Container
      maxWidth={false}
      sx={{ pt: 4, pb: 6, bgcolor: "background.default", px: 4 }}
    >
      <Typography variant="h5" color="text.primary" gutterBottom>
        People
      </Typography>

      <Grid container spacing={3} alignItems="stretch">
        {people.map((person) => (
          <Grid key={person.id} size={{ xs: 6, sm: 4, md: 2, lg: 1.5 }}>
            <PersonCard person={person} />
          </Grid>
        ))}
      </Grid>

      {loading && (
        <Box textAlign="center" py={2}>
          <CircularProgress color="secondary" />
        </Box>
      )}

      {!loading && hasMore && (
        <Box
          ref={loaderRef}
          textAlign="center"
          py={2}
          sx={{ color: "text.secondary" }}
        >
          Scroll to load more…
        </Box>
      )}
    </Container>
  );
}
