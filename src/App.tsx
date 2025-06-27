import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import SocialIcons from './components/SocialIcons';
import Home from './pages/Home';
import Blog from './pages/Blog';
import Hours from './pages/Hours';
import Projects from './pages/Projects';
import StarField from './components/StarField';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-black relative overflow-hidden">
          <StarField />
          <div className="relative z-10">
            <Header />
            <SocialIcons />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/blog" element={
                  <ProtectedRoute>
                    <Blog />
                  </ProtectedRoute>
                } />
                <Route path="/hours" element={
                  <ProtectedRoute>
                    <Hours />
                  </ProtectedRoute>
                } />
                <Route path="/projects" element={
                  <ProtectedRoute>
                    <Projects />
                  </ProtectedRoute>
                } />
              </Routes>
            </main>
            <Footer />
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;