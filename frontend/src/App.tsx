import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IndexPage from './pages/IndexPage';
import MediaDetailPage from './pages/MediaDetailPage';
import PersonDetailPage from './pages/PersonDetailPage';
import { Layout } from './components/Layout'
import TagDetailPage from './pages/TagDetailPage';
import ImagesPage from './pages/ImagesPage'
import VideosPage from './pages/VideosPage'
import PeoplePage from './pages/PeoplePage'
import TagsPage from './pages/TagPage';
import MapPage from './pages/MapPage';
import SearchPage from './pages/SearchResultPage';
import OrphanFacesPage from './pages/OrphanFaces';
import MapEditorPage from './pages/MapEditorPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<IndexPage />} />
          <Route path="/searchresults" element={<SearchPage />} />
          <Route path="/media/:id" element={<MediaDetailPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/maptagger" element={<MapEditorPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/orphanfaces" element={<OrphanFacesPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/person/:id" element={<PersonDetailPage />} />
          <Route path="/tag/:id" element={<TagDetailPage />} />
        </Route>
      </Routes>
    </Router>
  );
}