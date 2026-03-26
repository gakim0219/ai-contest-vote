import { Routes, Route, Navigate } from 'react-router-dom';
import VotePage from './pages/VotePage';
import JudgePage from './pages/JudgePage';
import PredictPage from './pages/PredictPage';
import PreliminaryPage from './pages/PreliminaryPage';
import CeremonyPage from './pages/CeremonyPage';
import AdminPage from './pages/AdminPage';
import DrawPage from './pages/DrawPage';
import RandomVotePage from './pages/RandomVotePage';

export default function App() {
  return (
    <Routes>
      <Route path="/vote" element={<VotePage />} />
      <Route path="/judge" element={<JudgePage />} />
      <Route path="/predict" element={<PredictPage />} />
      <Route path="/preliminary" element={<PreliminaryPage />} />
      <Route path="/ceremony" element={<CeremonyPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/draw" element={<DrawPage />} />
      <Route path="/random-vote" element={<RandomVotePage />} />
      <Route path="*" element={<Navigate to="/vote" replace />} />
    </Routes>
  );
}
