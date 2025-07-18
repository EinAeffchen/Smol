import AddIcon from "@mui/icons-material/Add";
import { Dialog, DialogTitle, DialogContent } from "@mui/material";
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineSeparator,
} from "@mui/lab";
import { MediaGrid } from "../components/MediaGrid";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { EventFormDialog } from "../components/EventFormDialog";
import { EventCard } from "./EventCard";
import { MediaItemGroup } from "./MediaItemGroup";
import {
  createTimelineEvent,
  deleteTimelineEvent,
  getPersonTimeline,
  updateTimelineEvent,
} from "../services/timeline";
import { defaultListState, useListStore } from "../stores/useListStore";
import {
  MediaPreview,
  Person,
  TimelineEvent,
  TimelineEventCreate,
  TimelineDisplayItem,
} from "../types";

export const TimelineTab: React.FC<{ person: Person }> = ({ person }) => {
  const [dayToView, setDayToView] = useState<MediaPreview[] | null>(null);
  const listKey = useMemo(() => `person-${person.id}-timeline`, [person.id]);
  const { items, hasMore, isLoading } = useListStore(
    (state) => state.lists[listKey] || defaultListState
  );
  const { fetchInitial, loadMore, clearList, removeItem } = useListStore();
  const { ref, inView } = useInView({
    threshold: 0.5,
    skip: isLoading || !hasMore,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<TimelineEvent | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (person.id) {
      fetchInitial(listKey, () => getPersonTimeline(person.id, null));
    }
  }, [person.id, fetchInitial, listKey, clearList]);

  useEffect(() => {
    if (inView) {
      loadMore(listKey, (cursor) => getPersonTimeline(person.id, cursor));
    }
  }, [inView, person.id, loadMore, listKey]);

  const handleOpenCreateDialog = () => {
    setEventToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEditDialog = (event: TimelineEvent) => {
    setEventToEdit(event);
    setIsFormOpen(true);
  };
  const handleCloseDialog = () => {
    setIsFormOpen(false);
    setEventToEdit(null);
  };

  const handleDeleteEvent = async (event: TimelineEvent) => {
    if (
      window.confirm(
        `Are you sure you want to delete the event "${event.title}"?`
      )
    ) {
      await deleteTimelineEvent(person.id, event.id);
      clearList(listKey);
      fetchInitial(listKey, () => getPersonTimeline(person.id, null));
    }
  };
  const handleSubmitEvent = async (eventData: TimelineEventCreate) => {
    setIsSubmitting(true);
    try {
      if (eventToEdit) {
        await updateTimelineEvent(person.id, eventToEdit.id, eventData);
        clearList(listKey);
        fetchInitial(listKey, () => getPersonTimeline(person.id, null));
      } else {
        await createTimelineEvent(person.id, eventData);
        clearList(listKey);
        fetchInitial(listKey, () => getPersonTimeline(person.id, null));
      }
      handleCloseDialog(); // Use the unified close handler
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayItems: TimelineDisplayItem[] = useMemo(() => {
    const grouped: (
      | TimelineDisplayItem
      | { type: "media_group"; date: string; items: MediaPreview[] }
    )[] = [];

    // The grouping logic from before remains the same...
    for (const item of items) {
      if (item.type === "event") {
        grouped.push(item);
        continue;
      }
      const lastItem = grouped[grouped.length - 1];
      if (lastItem?.type === "media_group" && lastItem.date === item.date) {
        lastItem.items.push(item.items);
      } else {
        grouped.push({
          type: "media_group",
          date: item.date,
          items: [item.items],
        });
      }
    }
    return grouped;
  }, [items]);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
        >
          Add Event
        </Button>
      </Box>

      <Timeline position="alternate">
        {displayItems.map((item, index) => {
          const panelKey = `${item.type}-${item.date}-${index}`;
          return (
            <TimelineItem key={panelKey}>
              <TimelineSeparator>
                <TimelineDot
                  color={item.type === "media_group" ? "primary" : "secondary"}
                />
                {index < displayItems.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent sx={{ py: "12px", px: 0 }}>
                {/* Each content block is now a collapsible Accordion */}
                <Typography variant="caption" color="text.secondary">
                  {item.date}
                </Typography>
                <Typography>
                  {item.type === "event" ? (
                    <EventCard
                      event={item.event}
                      onEdit={() => handleOpenEditDialog(item.event)}
                      onDelete={() => {
                        handleDeleteEvent(item.event);
                      }}
                    />
                  ) : (
                    <MediaItemGroup
                      mediaItems={item.items}
                      listKey={listKey}
                      date={""}
                      onViewAll={() => setDayToView(item.items)}
                    />
                  )}
                </Typography>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>
      <EventFormDialog
        open={isFormOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmitEvent}
        isSubmitting={isSubmitting}
        initialData={eventToEdit}
      />
      <Dialog
        open={!!dayToView}
        onClose={() => setDayToView(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Photos from{" "}
          {dayToView
            ? new Date(dayToView[0].created_at).toLocaleDateString()
            : ""}
        </DialogTitle>
        <DialogContent>
          {/* We reuse our generic grid component inside the dialog! */}
          {dayToView && <MediaGrid mediaItems={dayToView} listKey={listKey} />}
        </DialogContent>
      </Dialog>
      {hasMore && <Box ref={ref} sx={{ height: "1px" }} />}
      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};
