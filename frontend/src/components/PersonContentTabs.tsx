import React, { Suspense, useState, useEffect } from "react";
import {
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Typography,
  Button,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Person,
  FaceRead,
  SimilarPerson,
  PersonReadSimple,
  Tag,
  Media,
} from "../types";
import { TimelineTab } from "./TimelineTab";
import MediaAppearances from "./MediaAppearances";
import SimilarPersonCard from "./SimilarPersonCard";
import { TagsSection } from "./TagsSection";
const DetectedFaces = React.lazy(() => import("./DetectedFaces"));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`person-tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface PersonContentTabsProps {
  person: Person;
  detectedFacesList: FaceRead[];
  hasMoreFaces: boolean;
  loadingMoreFaces: boolean;
  onTagAdded: (tag: Tag) => void;
  loadMoreDetectedFaces: () => void;
  handleProfileAssignmentWrapper: (faceId: number, personId: number) => void;
  handleAssignWrapper: (faceIds: number[], personId: number) => void;
  handleCreateWrapper: (faceIds: number[], name?: string) => Promise<Person>;
  handleDeleteWrapper: (faceIds: number[]) => void;
  handleDetachWrapper: (faceIds: number[]) => void;
  suggestedFaces: FaceRead[];
  similarPersons: SimilarPerson[];
  onTagUpdate: (obj: Person | Media) => void;
  onRefreshSuggestions: () => void;
  onLoadSimilar: () => void;
  filterPeople: PersonReadSimple[];
  onFilterPeopleChange: () => void;
  mediaListKey: string;
}

export function PersonContentTabs(props: PersonContentTabsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [faceTabValue, setFaceTabValue] = useState(0);
  const [hasLoadedSimilar, setHasLoadedSimilar] = useState(false);
  const [isProcessingFaces, setIsProcessingFaces] = useState(false);

  const createActionHandler = <T extends (...args: any[]) => Promise<any> | void>(
    action: T
  ): ((...args: Parameters<T>) => Promise<void>) => {
    return async (...args: Parameters<T>) => {
      setIsProcessingFaces(true);
      try {
        await Promise.resolve(action(...args));
      } catch (error) {
        console.error("An error occurred during the face action:", error);
        // Optionally, show an error toast to the user here
      } finally {
        setIsProcessingFaces(false);
      }
    };
  };
  const handleAssign = createActionHandler(props.handleAssignWrapper);
  const handleCreate = createActionHandler(props.handleCreateWrapper);
  const handleDelete = createActionHandler(props.handleDeleteWrapper);
  const handleDetach = createActionHandler(props.handleDetachWrapper);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 2 && !hasLoadedSimilar) {
      props.onLoadSimilar();
      setHasLoadedSimilar(true);
    }
  };

  const handleFaceTabChange = (
    event: React.SyntheticEvent,
    newValue: number
  ) => {
    setFaceTabValue(newValue);
  };
  useEffect(() => {
    setHasLoadedSimilar(false);
    setTabValue(0);
  }, [props.person.id]);

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="Person content tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={`Media Appearances (${props.person.appearance_count})`} />
          <Tab label="Faces" />
          <Tab label="Similar People" />
          <Tab label="Timeline" />
          <Tab label="Tags" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Suspense fallback={<CircularProgress />}>
          <MediaAppearances
            person={props.person}
            filterPeople={props.filterPeople}
            onFilterPeopleChange={props.onFilterPeopleChange}
            mediaListKey={props.mediaListKey}
          />
        </Suspense>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={faceTabValue}
            onChange={handleFaceTabChange}
            aria-label="Faces content tabs"
          >
            <Tab label="Confirmed" />
            <Tab label="Suggested" />
          </Tabs>
        </Box>
        <TabPanel value={faceTabValue} index={0}>
          <Suspense fallback={<CircularProgress />}>
            <DetectedFaces
              isProcessing={isProcessingFaces}
              title="Confirmed Faces"
              faces={props.detectedFacesList}
              profileFaceId={props.person.profile_face_id}
              onSetProfile={(faceId) =>
                props.handleProfileAssignmentWrapper(faceId, props.person.id)
              }
              onAssign={handleAssign}
              onDelete={handleDelete}
              onDetach={handleDetach}
              onCreateMultiple={handleCreate}
              onLoadMore={props.loadMoreDetectedFaces}
              hasMore={props.hasMoreFaces}
              isLoadingMore={props.loadingMoreFaces}
              personId={props.person.id}
            />
          </Suspense>
        </TabPanel>
        <TabPanel value={faceTabValue} index={1}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6">Suggestions</Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => props.onRefreshSuggestions()}
            >
              Refresh Suggestions
            </Button>
          </Box>
          <Suspense fallback={<CircularProgress />}>
            <DetectedFaces
              isProcessing={isProcessingFaces}
              title="Suggested Faces"
              faces={props.suggestedFaces}
              onAssign={handleAssign}
              onDelete={handleDelete}
              onDetach={handleDetach}
              onCreateMultiple={handleCreate}
              personId={props.person.id}
            />
          </Suspense>
        </TabPanel>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {props.similarPersons.length > 0 ? (
          <Grid container spacing={2}>
            {props.similarPersons.map((p) => (
              <Grid key={p.id} size={{ xs: 6, sm: 3, md: 2 }}>
                <SimilarPersonCard {...p} />
              </Grid>
            ))}
          </Grid>
        ) : (
          hasLoadedSimilar && <CircularProgress />
        )}
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <Suspense fallback={<CircularProgress />}>
          <TimelineTab person={props.person} />
        </Suspense>
      </TabPanel>
      <TabPanel value={tabValue} index={4}>
        <TagsSection
          person={props.person}
          onTagAdded={(person) => props.onTagAdded(person)}
          onUpdate={props.onTagUpdate}
        />
      </TabPanel>
    </Box>
  );
}
