import './App.css';
import MyApp from './mainhome';
import 'core-js/stable';
import 'regenerator-runtime/runtime';

function App() {
  return (
    <div className="App">
      <MyApp/>
      
      {/* <iframe src="http://localhost:3000" 
              width="600" 
              height="400" 
              frameborder="0" 
              allowfullscreen>
      </iframe> */}
    </div>
  );
}

export default App;
