import React, { Suspense, useState, useEffect } from "react";
import {
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Typography,
  Grid,
  Button,
} from "@mui/material";
import { Media, Person, Tag, FaceRead, SimilarPerson } from "../types";

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
  onTagAdded: (updatedPerson: Person) => void;
  loadMoreDetectedFaces: () => void;
  handleProfileAssignmentWrapper: (faceId: number, personId: number) => void;
  handleAssignWrapper: (faceIds: number[], personId: number) => void;
  handleCreateWrapper: (faceIds: number[], name: string) => Promise<Person>;
  handleDeleteWrapper: (faceIds: number[]) => void;
  handleDetachWrapper: (faceIds: number[]) => void;
  suggestedFaces: FaceRead[];
  similarPersons: SimilarPerson[];
  onTagUpdate: () => void;
  onRefreshSuggestions: () => void;
  onLoadSimilar: () => void;
}

export function PersonContentTabs(props: PersonContentTabsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [faceTabValue, setFaceTabValue] = useState(0);
  const [hasLoadedSimilar, setHasLoadedSimilar] = useState(false);

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
          <Tab label="Suggested Faces" />
          <Tab label="Similar People" />
          <Tab label="Tags" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Suspense fallback={<CircularProgress />}>
          <MediaAppearances
            person={props.person}
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
              title="Confirmed Faces"
              faces={props.detectedFacesList}
              profileFaceId={props.person.profile_face_id}
              onSetProfile={(faceId) =>
                props.handleProfileAssignmentWrapper(faceId, props.person.id)
              }
              onAssign={(faceIds, personId) => props.handleAssignWrapper(faceIds, personId)}
              onCreate={props.handleCreateWrapper}
              onDelete={(faceIds) => props.handleDeleteWrapper(faceIds)}
              onDetach={(faceIds) => props.handleDetachWrapper(faceIds)}
              onLoadMore={props.loadMoreDetectedFaces}
              hasMore={props.hasMoreFaces}
              isLoadingMore={props.loadingMoreFaces}
              personId={props.person.id}
              onCreateMultiple={props.handleCreateWrapper}
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
              title="Suggested Faces"
              faces={props.suggestedFaces}
              onAssign={(faceIds, personId) => props.handleAssignWrapper(faceIds, personId)}
              onCreate={props.handleCreateWrapper}
              onDelete={(faceIds) => props.handleDeleteWrapper(faceIds)}
              onDetach={(faceIds) => props.handleDetachWrapper(faceIds)}
              personId={props.person.id}
              onCreateMultiple={props.handleCreateWrapper}
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
        <TagsSection
          person={props.person}
          onTagAdded={props.onTagAdded}
          onUpdate={props.onTagUpdate}
        />
      </TabPanel>
    </Box>
  );
}
