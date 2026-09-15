import AgriMarket from "./agri/AgriMarket";
import AdminDashboard from "./agri/AdminDashboard";

function App() {
  const params = new URLSearchParams(window.location.search);
  const isAdmin = params.get("admin") === "1";

  return isAdmin ? <AdminDashboard /> : <AgriMarket />;
}

export default App;