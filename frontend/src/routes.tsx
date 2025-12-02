import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import IndexPage from "./pages/IndexPage";
import MediaDetailPage from "./pages/MediaDetailPage";
import PersonDetailPage from "./pages/PersonDetailPage";
import { Layout } from "./components/Layout";
import TagDetailPage from "./pages/TagDetailPage";
import ImagesPage from "./pages/ImagesPage";
import VideosPage from "./pages/VideosPage";
import PeoplePage from "./pages/PeoplePage";
import TagsPage from "./pages/TagPage";
import MapPage from "./pages/MapPage";
import SearchPage from "./pages/SearchResultPage";
import OrphanFacesPage from "./pages/OrphanFaces";
import MapEditorPage from "./pages/MapEditorPage";
import DuplicatesPage from "./pages/DuplicatesPage";
import ConfigurationPage from "./pages/ConfigurationPage";
import MissingFilesPage from "./pages/MissingFilesPage";
import { WriteModeBoundary } from "./components/ReadOnlyBoundary";

export const AppRoutes = () => {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/" element={<Layout />}>
          <Route index element={<IndexPage />} />
          <Route path="/searchresults" element={<SearchPage />} />
          <Route path="/medium/:id" element={<MediaDetailPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route
            path="/geotagger"
            element={
              <WriteModeBoundary description="Geo-tagging tools are disabled while the system is in read-only mode.">
                <MapEditorPage />
              </WriteModeBoundary>
            }
          />
          <Route path="/tags" element={<TagsPage />} />
          <Route
            path="/orphanfaces"
            element={
              <WriteModeBoundary description="Face assignment tools are disabled while the system is in read-only mode.">
                <OrphanFacesPage />
              </WriteModeBoundary>
            }
          />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/person/:id" element={<PersonDetailPage />} />
          <Route path="/tag/:id" element={<TagDetailPage />} />
          <Route
            path="/duplicates"
            element={
              <WriteModeBoundary description="Duplicate review actions are disabled while the system is in read-only mode.">
                <DuplicatesPage />
              </WriteModeBoundary>
            }
          />
          <Route
            path="/configuration"
            element={
              <WriteModeBoundary description="Configuration settings cannot be viewed or edited while the system is in read-only mode.">
                <ConfigurationPage />
              </WriteModeBoundary>
            }
          />
          <Route
            path="/missing"
            element={
              <WriteModeBoundary description="Missing file review is disabled while the system is in read-only mode.">
                <MissingFilesPage />
              </WriteModeBoundary>
            }
          />
        </Route>
      </Routes>
      {backgroundLocation && (
        <Routes>
          <Route path="/medium/:id" element={<MediaDetailPage />} />
        </Routes>
      )}
    </>
  );
};
