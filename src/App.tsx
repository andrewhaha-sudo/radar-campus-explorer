import { RadarProvider } from "./components/radar/RadarProvider";
import { RadarShell } from "./components/radar/RadarShell";
import { StudentProfilesProvider } from "./components/student/StudentProfiles";

export default function App() {
  return (
    <>
      <a className="skip-link" href="#campus-map">
        Skip to interactive map
      </a>
      <main>
        <StudentProfilesProvider>
          <RadarProvider>
            <RadarShell />
          </RadarProvider>
        </StudentProfilesProvider>
      </main>
    </>
  );
}
