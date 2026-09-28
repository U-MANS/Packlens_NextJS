'use client';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppBootstrap } from './components/auth/AppBootstrap';

import Login from './views/Login';
import RegisterDebug from './views/RegisterDebug';
import { Toaster } from './components/ui/Toast';
import Dashboard from './views/Dashboard';
import ProjectList from './views/ProjectList';
import ProjectDetail from './views/ProjectDetail';
import NewProject from './views/NewProject';
import Users from './views/Users';
import Agents from './views/Agents';
import AcceptInvite from './views/AcceptInvite';
import Library from './views/Library';
import LibraryProduct from './views/LibraryProduct';
import Moodboard from './views/Moodboard';
import CampaignsCalendar from './views/CampaignsCalendar';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<><Login /><Toaster /></>} />
        <Route path="/register-debug" element={<><RegisterDebug /><Toaster /></>} />
        <Route path="/invite/:token" element={<><AcceptInvite /><Toaster /></>} />
        <Route
          element={
            <ProtectedRoute>
              <AppBootstrap />
            </ProtectedRoute>
          }
        >
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/new" element={<NewProject />} />
            <Route path="projects/:id/*" element={<ProjectDetail />} />
            <Route path="library" element={<Library />} />
            <Route path="library/:skuBase" element={<LibraryProduct />} />
            <Route path="moodboard" element={<Moodboard />} />
            <Route path="campaigns" element={<CampaignsCalendar />} />
            <Route path="campaigns/*" element={<Navigate to="/campaigns" replace />} />
            <Route path="users" element={<Users />} />
            <Route path="agents" element={<Agents />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
