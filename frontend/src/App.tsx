import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IndexPage from './pages/IndexPage';
import VideoDetailPage from './pages/VideoDetailPage';
import ImageDetailPage from './pages/ImageDetailPage';
import PersonDetailPage from './pages/PersonDetailPage';
import { Layout } from './components/Layout'
import TagDetailPage from './pages/TagDetailPage';
import ImagesPage from './pages/ImagesPage'
import VideosPage from './pages/VideosPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<IndexPage />} />
          <Route path="/video/:id" element={<VideoDetailPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/image/:id" element={<ImageDetailPage />} />
          <Route path="/person/:id" element={<PersonDetailPage />} />
          <Route path="/tag/:id" element={<TagDetailPage />} />
        </Route>
      </Routes>
    </Router>
  );
}