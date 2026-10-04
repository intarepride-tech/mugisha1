import AgriMarket from "./agri/AgriMarket";
import AdminDashboard from "./agri/AdminDashboard";

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path.toLowerCase() === "/stock") {
    return <AdminDashboard />;
  }

  return <AgriMarket />;
}

export default App;