import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import Play from './pages/Play';
import Register from './pages/Register';
import Login from './pages/Login';
import TryPlay from './pages/TryPlay';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/play/:roomId" element={<Play />} />
        <Route path="/try" element={<TryPlay />} />
      </Routes>
    </BrowserRouter>
  );
}
