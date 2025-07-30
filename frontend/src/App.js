// import { Route } from 'lucide-react';
import './App.css';
import MyApp from './mainhome';
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import RoomPage from './comp_rooms/roomPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element = {<MyApp/>}/>
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </Router>
  );
}

export default App;
