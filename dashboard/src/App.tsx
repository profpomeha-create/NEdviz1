import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SummaryPage from './pages/SummaryPage';
import MarketPage from './pages/MarketPage';
import ExpressPage from './pages/ExpressPage';
import DynamicsPage from './pages/DynamicsPage';
import DynamicsPage41 from './pages/DynamicsPage41';
import DynamicsPage42 from './pages/DynamicsPage42';
import DynamicsPage43 from './pages/DynamicsPage43';
import DynamicsPage44 from './pages/DynamicsPage44';
import CompetitivePage from './pages/CompetitivePage';
import MortgagePage from './pages/MortgagePage';
import TodayPage from './pages/TodayPage';
import ForecastPage from './pages/ForecastPage';
import WashoutPage from './pages/WashoutPage';
import NewLotsPage from './pages/NewLotsPage';
import MarketingPage from './pages/MarketingPage';
import CommercialPage from './pages/CommercialPage';
import { DataProvider } from './lib/data';
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <Routes>
          <Route path="/" element={<SummaryPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/express" element={<ExpressPage />} />
          <Route path="/dynamics" element={<DynamicsPage />} />
          <Route path="/dynamics/4.1" element={<DynamicsPage41 />} />
          <Route path="/dynamics/4.2" element={<DynamicsPage42 />} />
          <Route path="/dynamics/4.3" element={<DynamicsPage43 />} />
          <Route path="/dynamics/4.4" element={<DynamicsPage44 />} />
          <Route path="/competitive" element={<CompetitivePage />} />
          <Route path="/mortgage" element={<MortgagePage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/washout" element={<WashoutPage />} />
          <Route path="/new" element={<NewLotsPage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/commercial" element={<CommercialPage />} />
        </Routes>
      </DataProvider>
    </BrowserRouter>
  );
}
