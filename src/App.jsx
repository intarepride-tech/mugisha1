import AgriMarket from "./agri/AgriMarket";
import AdminDashboard from "./agri/AdminDashboard";

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  // Private Zao Deal stock/admin page.
  // Visiting /stock opens the admin dashboard.
  if (pathname === "/stock") {
    return <AdminDashboard />;
  }

  return <AgriMarket />;
}

export default App;