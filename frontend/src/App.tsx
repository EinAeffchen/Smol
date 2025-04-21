import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IndexPage from './pages/IndexPage';
import VideoDetailPage from './pages/VideoDetailPage';
import ImageDetailPage from './pages/ImageDetailPage';
import PersonDetailPage from './pages/PersonDetailPage';
import TagDetailPage from './pages/TagDetailPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/video/:id" element={<VideoDetailPage />} />
        <Route path="/image/:id" element={<ImageDetailPage />} />
        <Route path="/person/:id" element={<PersonDetailPage />} />
        <Route path="/tag/:id" element={<TagDetailPage />} />
      </Routes>
    </Router>
  );
}