import { CampusExplorer } from "./components/map/CampusExplorer";
import { StudentProfilesProvider } from "./components/student/StudentProfiles";

export default function App() {
  return (
    <>
      <a className="skip-link" href="#campus-map">
        Skip to interactive map
      </a>
      <main>
        <StudentProfilesProvider>
          <CampusExplorer />
        </StudentProfilesProvider>
      </main>
    </>
  );
}
