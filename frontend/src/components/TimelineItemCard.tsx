import { Card, CardContent, CardHeader } from "@mui/material";
import { TimelineItem } from "../types";
import MediaCard from "./MediaCard";

// components/TimelineItemCard.tsx
interface TimelineItemCardProps {
  item: TimelineItem;
}
export const TimelineItemCard: React.FC<TimelineItemCardProps> = ({ item }) => {
  // Use a switch on item.type to decide what to render
  switch (item.type) {
    case "media":
      // Render a small MediaCard or similar component using item.data
      return <MediaCard media={item.data} />;
    case "event":
      return (
        <Card>
          <CardHeader
            title={item.data.title}
            subheader={item.data.event_date}
          />
          <CardContent>{item.data.description}</CardContent>
        </Card>
      );
    default:
      return null;
  }
};
